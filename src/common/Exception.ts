export abstract class AppError<C> extends Error {
  protected errorCode: string;
  protected context?: C;
  getErrorCode() {
    return this.errorCode;
  }

  getContext() {
    return this.context;
  }
}

export abstract class UnexpectedError<C> extends AppError<C> {}
