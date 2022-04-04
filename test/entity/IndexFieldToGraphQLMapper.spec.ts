import { IndexFieldToGraphQLMapper } from '../../src/entity/IndexFieldToGraphQLMapper';

describe('IndexFieldToGraphQLMapper', () => {
  it('map method should return correct graphql', () => {
    const expected = `{userList (ids: ["1", "2"]) {
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
    const actual = new IndexFieldToGraphQLMapper().map(
      'User',
      ['1', '2'],
      [
        { name: 'id' },
        { name: 'displayName' },
        { name: 'organization.organizationId' },
        { name: 'organization.displayName' },
        { name: 'organization.group.groupId' },
        { name: 'organization.group.displayName' },
      ],
    );

    expect(actual).toEqual(expected);
  });
});
