import { Injectable } from '@nestjs/common';
import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import { FieldIndexOption } from '../configuration';
import * as OS from 'os';

interface IndexFieldTree {
  name: string;
  children: IndexFieldTree[];
}

@Injectable()
export class IndexFieldToGraphQLMapper {
  private createJson(path: string[], json: Record<any, any>) {
    const name = path.shift();
    if (!json[name]) {
      json[name] = {};
    }
    if (path.length === 0) return;
    this.createJson(path, json[name]);
  }

  private parse(fields: FieldIndexOption[]) {
    const json: Record<any, any> = {};
    const data = fields.map(({ name }) => name);
    data.forEach((path) => {
      const split: string[] = path.split('.');
      this.createJson(split, json);
    });
    return json;
  }

  map(entityType: string, id: any, fields: FieldIndexOption[]) {
    const query = {
      [entityType.toLowerCase()]: {
        __args: {
          [`${entityType.toLowerCase()}Id`]: id,
        },
        ...this.parse(fields),
      },
    };
    return `{${jsonToGraphQLQuery(query, { pretty: true })}}`;
  }
}