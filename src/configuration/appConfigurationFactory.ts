import { ConfigFactory } from '@nestjs/config';
import { IndexerConfiguration } from './Types';
import * as yaml from 'js-yaml';
import { join } from 'path';
import { readFileSync } from 'fs';

const appConfigurationFactory: ConfigFactory<IndexerConfiguration> = () => {
  const config: IndexerConfiguration = yaml.load(
    readFileSync(join(process.env.CONFIG_PATH), 'utf8'),
  ) as IndexerConfiguration;

  return config;
};

export default appConfigurationFactory;
