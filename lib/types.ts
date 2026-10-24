'use strict';

// --- REST API Response Types ---

export interface ApiResponse<T = unknown> {
  Data: T;
  Status: string;
  Alert?: Record<string, unknown>;
}

export interface UserProfile {
  Sernum: string;
  eSERNUM?: string;
  MyRobotName?: string;
  connectVia?: string;
  mob_token?: string;
}

export interface RobotDetails {
  eSERNUM: string;
  SERNUM: string;
  PARTNAME: string;
  PARTDES: string;
  AppName: string;
  RegDate: string;
  MyRobotName: string;
  isReg: boolean;
  RobotFamily: string;
}

export interface AwsCredentials {
  Token: string;
  AccessKeyId: string;
  SecretAccessKey: string;
  TokenExpiration?: string;
}

// --- AWS Cognito Types ---

export interface CognitoAuthenticationResult {
  IdToken: string;
  AccessToken?: string;
  RefreshToken?: string;
  ExpiresIn: number;
}

export interface CognitoResponse {
  ChallengeName?: string;
  Session?: string;
  AuthenticationResult?: CognitoAuthenticationResult;
}

// --- AWS IoT Shadow Types ---

export interface DeviceShadow {
  state: {
    reported?: ReportedState;
    desired?: Record<string, unknown>;
  };
  version?: number;
  timestamp?: number;
}

export interface ReportedState {
  systemState?: SystemState;
  cycleInfo?: CycleInfo;
  led?: LedState;
  filterBagIndication?: FilterBagIndication;
  debug?: DebugInfo;
  wifi?: WifiInfo;
  robotError?: ErrorInfo;
  pwsError?: ErrorInfo;
  activity?: string;
  isConnected?: { connected: boolean };
  robotSerial?: string;
  versions?: Versions;
}

export interface Versions {
  pwsVersion?: { pwsHwVersion?: string; pwsSwVersion?: string };
  robotVersion?: { muHwVersion?: string; muSwVersion?: string };
}

export interface SystemState {
  pwsState: string;
  robotState: string;
  robotType?: string;
  isBusy?: boolean;
  rTurnOnCount?: number;
  timeZone?: number;
  timeZoneName?: string;
}

export interface CycleInfo {
  cleaningMode?: {
    mode: string;
    cycleTime?: number;
  };
  cycleStartTime?: number; // Local time, offset by systemState.timeZone
  cycleStartTimeUTC?: number;
}

export interface LedState {
  ledMode: number;
  ledIntensity: number;
  ledEnable: boolean;
}

export interface FilterBagIndication {
  state: number;
  resetFBI?: boolean;
}

export interface DebugInfo {
  WIFI_RSSI?: number;
  WIFI_NETName?: string;
}

export interface WifiInfo {
  netName?: string;
}

export interface ErrorInfo {
  errorCode: number;
  turnOnCount?: number;
}

// --- Dynamic Topic Types ---

export interface DynamicMessage {
  type: string;
  description?: string;
  content?: Record<string, unknown>;
  temperature?: number;
}
