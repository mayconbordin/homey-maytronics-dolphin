'use strict';

import Homey from 'homey';
import { AuthError, MaytronicsApi } from '../../lib/MaytronicsApi';
import { DEFAULT_DEVICE_TYPE } from '../../lib/constants';
import type { RobotDetails } from '../../lib/types';
import type DolphinDevice from './device';

class DolphinDriver extends Homey.Driver {

  async onInit() {
    // Register flow card listeners

    // Action: Start cleaning with mode
    this.homey.flow.getActionCard('start_cleaning')
      .registerRunListener(async (args: { device: DolphinDevice; mode: string }) => {
        await args.device.startCleaning(args.mode);
      });

    // Action: Stop cleaning
    this.homey.flow.getActionCard('stop_cleaning')
      .registerRunListener(async (args: { device: DolphinDevice }) => {
        await args.device.stopCleaning();
      });

    // Action: Return to base
    this.homey.flow.getActionCard('return_to_base')
      .registerRunListener(async (args: { device: DolphinDevice }) => {
        await args.device.returnToBase();
      });

    // Action: Set LED
    this.homey.flow.getActionCard('set_led')
      .registerRunListener(async (args: { device: DolphinDevice; mode: string; brightness: number }) => {
        await args.device.setLed(args.mode, args.brightness);
      });

    // Action: Navigate robot
    this.homey.flow.getActionCard('navigate')
      .registerRunListener(async (args: { device: DolphinDevice; direction: string }) => {
        await args.device.navigate(args.direction);
      });

    // Action: Exit manual navigation
    this.homey.flow.getActionCard('exit_navigation')
      .registerRunListener(async (args: { device: DolphinDevice }) => {
        await args.device.exitNavigation();
      });

    // Condition: Is cleaning
    this.homey.flow.getConditionCard('is_cleaning')
      .registerRunListener(async (args: { device: DolphinDevice }) => {
        const mode = args.device.getCapabilityValue('cleaning_mode');
        return mode !== 'off' && mode != null;
      });

    this.log('DolphinDriver has been initialized');
  }

  /**
   * Register the email OTP login handlers used by the login view.
   * `onVerified` runs once the emailed code has been accepted.
   */
  private registerLoginHandlers(
    session: Homey.Driver.PairSession,
    api: MaytronicsApi,
    onVerified: (email: string) => Promise<void>,
  ): void {
    let email = '';
    let cognitoSession = '';

    session.setHandler('send_code', async (data: { email: string }) => {
      email = String(data.email || '').trim();
      if (!email) {
        throw new Error(this.homey.__('pair.login.error_email_required'));
      }
      cognitoSession = await api.startLogin(email);
      return true;
    });

    session.setHandler('verify_code', async (data: { code: string }) => {
      if (!cognitoSession) {
        throw new Error(this.homey.__('pair.login.error_no_code_sent'));
      }
      try {
        await api.verifyCode(email, cognitoSession, String(data.code || ''));
      } catch (err) {
        // A wrong code returns a new session that the next attempt must use
        if (err instanceof AuthError && err.session) {
          cognitoSession = err.session;
        }
        throw err;
      }
      await onVerified(email);
      return true;
    });
  }

  /**
   * Look up the robot linked to the signed-in account.
   */
  private async getRobot(api: MaytronicsApi) {
    const profile = await api.getUserProfile();
    const serialNumber = profile.Sernum;
    if (!serialNumber) {
      throw new Error(this.homey.__('pair.login.error_no_robot'));
    }

    let details: Partial<RobotDetails> = {};
    try {
      details = await api.getRobotDetails(serialNumber);
    } catch (err) {
      this.error('Failed to get robot details, continuing with profile data:', err);
    }

    // The AWS IoT thing name is the motor unit serial, which is the first 8
    // characters of the robot serial when the API does not report it
    const motorUnitSerial = profile.eSERNUM || details.eSERNUM || serialNumber.substring(0, 8);

    return {
      name: profile.MyRobotName || details.MyRobotName
        || `Dolphin ${details.RobotFamily || details.PARTDES || 'Pool Cleaner'}`,
      serialNumber,
      motorUnitSerial,
      deviceType: profile.connectVia || DEFAULT_DEVICE_TYPE,
      robotFamily: details.RobotFamily || '',
      productName: details.PARTDES || '',
    };
  }

  async onPair(session: Homey.Driver.PairSession) {
    const api = new MaytronicsApi();
    let email = '';
    let robot: Awaited<ReturnType<DolphinDriver['getRobot']>> | undefined;

    this.registerLoginHandlers(session, api, async (verifiedEmail) => {
      email = verifiedEmail;
      robot = await this.getRobot(api);
    });

    session.setHandler('list_devices', async () => {
      if (!robot) {
        return [];
      }

      return [
        {
          name: robot.name,
          data: {
            id: robot.motorUnitSerial,
          },
          store: {
            email,
            refreshToken: api.getRefreshToken(),
            serialNumber: robot.serialNumber,
            motorUnitSerial: robot.motorUnitSerial,
            deviceType: robot.deviceType,
            robotFamily: robot.robotFamily,
            productName: robot.productName,
          },
        },
      ];
    });
  }

  async onRepair(session: Homey.Driver.PairSession, device: Homey.Device) {
    const api = new MaytronicsApi();

    this.registerLoginHandlers(session, api, async (email) => {
      const robot = await this.getRobot(api);
      const { serialNumber } = device.getStore();
      if (serialNumber && serialNumber !== robot.serialNumber) {
        throw new Error(this.homey.__('pair.login.error_wrong_robot'));
      }

      await device.setStoreValue('email', email);
      await device.setStoreValue('refreshToken', api.getRefreshToken());
      await device.setStoreValue('serialNumber', robot.serialNumber);
      await device.setStoreValue('deviceType', robot.deviceType);

      // Devices paired before the OTP login kept the password in settings
      await device.setSettings({ email: null, password: null }).catch(this.error);

      await (device as DolphinDevice).reconnect();
    });
  }
}

module.exports = DolphinDriver;
export default DolphinDriver;
