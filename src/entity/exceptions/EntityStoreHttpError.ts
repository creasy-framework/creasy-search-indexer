import { UnexpectedError } from '../../common';
import { ENTITY_STORE_REQUEST_FAILED } from '../Constants';

export class EntityStoreHttpError extends UnexpectedError<undefined> {
  readonly errorCode: string;
  constructor() {
    super();
    this.errorCode = ENTITY_STORE_REQUEST_FAILED;
  }
}
