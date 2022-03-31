import { Injectable } from '@nestjs/common';
import { EntityFieldProperty, EntitySchemaDto } from './Types';
import { SchemaRepository } from './SchemaRepository';

@Injectable()
export class SchemaService {
  private cachedSchemas: EntitySchemaDto[];

  constructor(private repository: SchemaRepository) {}

  async isRelevant(rootEntityType: string, entityType: string) {
    return Object.keys(await this.getDependencies(rootEntityType)).includes(
      entityType,
    );
  }

  async getDependencies(rootEntityType: string) {
    const schemas = await this.getAllSchemas();
    return this.getDependenciesForRootEntity(rootEntityType, schemas);
  }

  async getSchemas(rootEntityType: string) {
    const schemas = await this.getAllSchemas();
    const dependencies = this.getDependenciesForRootEntity(
      rootEntityType,
      schemas,
    );
    return schemas.filter(
      (schema) =>
        schema.entityType === rootEntityType ||
        Object.keys(dependencies).includes(schema.entityType),
    );
  }

  private getDependenciesForRootEntity(
    rootEntityType: string,
    schemas: EntitySchemaDto[],
  ) {
    const rootEntitySchema = schemas.find(
      ({ entityType }) => entityType === rootEntityType,
    );
    return this.resolvePathForDependencies(rootEntitySchema, schemas);
  }

  private async getAllSchemas() {
    // TO DO: refresh cache
    if (!this.cachedSchemas) {
      this.cachedSchemas = await this.repository.getEntitySchemas();
    }
    return this.cachedSchemas;
  }

  private getRefTypeFromProperty(property: EntityFieldProperty) {
    const { refType, items = {} } = property;
    return refType || items.refType;
  }

  private mergeResolvedPaths(
    source: Record<string, string[]>,
    target: Record<string, string[]>,
  ) {
    return Object.entries(source).reduce<Record<string, string[]>>(
      (mergedPaths, entry) => {
        const [refType, paths] = entry;
        const { [refType]: existingPaths = [] } = mergedPaths;
        return {
          ...mergedPaths,
          [refType]: Array.from(new Set([...existingPaths, ...paths])),
        };
      },
      target,
    );
  }

  private buildPath(propertyName: string, parentPath: string) {
    let trimmedPropertyName = propertyName;
    if (trimmedPropertyName.toUpperCase().endsWith('IDS')) {
      trimmedPropertyName = trimmedPropertyName.substr(
        0,
        trimmedPropertyName.length - 3,
      );
    } else if (trimmedPropertyName.toUpperCase().endsWith('ID')) {
      trimmedPropertyName = trimmedPropertyName.substr(
        0,
        trimmedPropertyName.length - 2,
      );
    }
    return parentPath
      ? `${parentPath}.${trimmedPropertyName}`
      : trimmedPropertyName;
  }

  private resolvePathForDependencies(
    currentSchema: EntitySchemaDto,
    schemas: EntitySchemaDto[],
    parentPath = '',
  ) {
    if (!currentSchema) return {};
    const { entitySchema } = currentSchema;
    return Object.entries(entitySchema.properties).reduce<
      Record<string, string[]>
    >((dependencies, entry) => {
      const [name, property] = entry;
      const refType = this.getRefTypeFromProperty(property);
      if (refType) {
        const paths = dependencies[refType] || [];
        const path = this.buildPath(name, parentPath);
        const parentPaths = {
          ...dependencies,
          [refType]: [...paths, path],
        };
        if (refType !== currentSchema.entityType) {
          const refEntitySchema = schemas.find(
            ({ entityType }) => entityType === refType,
          );
          const nestedPaths = this.resolvePathForDependencies(
            refEntitySchema,
            schemas,
            path,
          );
          return this.mergeResolvedPaths(nestedPaths, parentPaths);
        }
        return parentPaths;
      }
      return dependencies;
    }, {});
  }
}
