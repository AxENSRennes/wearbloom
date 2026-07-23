export type ApiVariables = {
  userId: string;
  requestId: string;
  rawBody?: Uint8Array;
};

export type ApiEnv = { Variables: ApiVariables };
