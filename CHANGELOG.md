# Changelog

All notable changes to this app are listed here. The short release notes shown in the Homey App Store are in `.homeychangelog.json`.

## [1.1.0] - 2026-10-24

### Changed
- Sign in with a code sent by email instead of a password. Maytronics retired the email/password login this app used, so the `curl` account-registration workaround is no longer needed.
- The app stores a sign-in (refresh) token instead of your password.
- When the sign-in expires (Maytronics asks about once a year), the device shows a message asking you to repair it, instead of retrying every minute.

### Added
- Cleaning modes Walls Only, Cove, Spot Clean, Stairs, TicTac and Custom, in the device picker and the "Start cleaning" flow card.
- Power Supply Error sensor and an "A power supply error occurred" flow trigger.
- Robot Connected sensor.
- Serial number and firmware versions under Robot information in the device settings.

### Fixed
- The Time Remaining sensor never showed a value.
- A robot in a cleaning mode the app didn't know, such as Stairs, caused an error and left the cleaning mode out of date.
- Error code 255, which means no error, was shown as "Error 255" and set off the error flow.
- Water temperature is requested from M700 robots again. The new Maytronics API doesn't report the robot family, so M700 is also recognised from the product name.

### Removed
- The empty water temperature sensor on robots that don't have one.

### Upgrading
Devices paired with an earlier version show as unavailable after the update. Open the device, choose **Repair** and sign in with an emailed code. Your flows keep working.

## [1.0.4] - 2026-02-08

### Added
- Robot driving control: move forward, backward, left and right, stop, and exit manual navigation.

## [1.0.3] - 2026-02-08

### Changed
- New driver images.

## [1.0.2] - 2026-02-08

- First release.

[1.1.0]: https://github.com/mayconbordin/homey-maytronics-dolphin/releases/tag/v1.1.0
