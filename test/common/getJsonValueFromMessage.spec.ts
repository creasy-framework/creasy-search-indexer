import { getJsonValueFromMessage } from '../../src/common';

describe('getJsonValueFromMessage', () => {
  it('should get json value from message', () => {
    expect(getJsonValueFromMessage({ value: '{"a": "value a"}' })).toEqual({
      a: 'value a',
    });
  });

  it('should get empty object when value is undefined', () => {
    expect(getJsonValueFromMessage({ value: undefined })).toEqual({});
  });

  it('should get empty object when value is invalid json', () => {
    expect(getJsonValueFromMessage({ value: 'abc' })).toEqual({});
  });
});
