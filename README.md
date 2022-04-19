[![CircleCI](https://circleci.com/gh/creasy-framework/creasy-search-indexer/tree/master.svg?style=svg&circle-token=5e43aa3a7cfd6c2a3a731355e7051c5df8c5f570)](https://circleci.com/gh/creasy-framework/creasy-search-indexer/tree/master)

## Service Architecture

![launch page](assets/service-architecture.png 'Architecture')


## Development

Run dependencies
```bash
./scripts/start-dependencies.sh
```

Start indexer
```bash
docker-compose -f docker-compose-app.yml up
```

Run tests
```bash
yarn test:watch
```