[![CircleCI](https://circleci.com/gh/rivneglee/creasy-search-indexer/tree/master.svg?style=svg&circle-token=56602b49848d2b953315b3738fd5931d26ca497d)](https://circleci.com/gh/rivneglee/creasy-search-indexer/tree/master)

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