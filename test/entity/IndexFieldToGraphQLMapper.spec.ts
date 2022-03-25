import { IndexFieldToGraphQLMapper } from '../../src/entity/IndexFieldToGraphQLMapper';

describe('IndexFieldToGraphQLMapper', () => {
  it('map method should return correct graphql', () => {
    const expected = `{user (id: "123") {
    id
    displayName
    organization {
        organizationId
        displayName
        group {
            groupId
            displayName
        }
    }
}}`;
    const actual = new IndexFieldToGraphQLMapper().map('User', '123', [
      { name: 'id' },
      { name: 'displayName' },
      { name: 'organization.organizationId' },
      { name: 'organization.displayName' },
      { name: 'organization.group.groupId' },
      { name: 'organization.group.displayName' },
    ]);

    expect(actual).toEqual(expected);
  });
});
