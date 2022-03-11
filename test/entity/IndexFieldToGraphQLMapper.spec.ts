import { IndexFieldToGraphQLMapper } from '../../src/entity/IndexFieldToGraphQLMapper';

describe('IndexFieldToGraphQLMapper', () => {
  it('map method should return correct graphql', () => {
    const expected = `user (userId: "123") {
    userId
    displayName
    organization {
        organizationId
        displayName
        group {
            groupId
            displayName
        }
    }
}`;
    const actual = new IndexFieldToGraphQLMapper().map('User', '123', [
      { name: 'userId' },
      { name: 'displayName' },
      { name: 'organization.organizationId' },
      { name: 'organization.displayName' },
      { name: 'organization.group.groupId' },
      { name: 'organization.group.displayName' },
    ]);

    expect(actual).toEqual(expected);
  });
});
