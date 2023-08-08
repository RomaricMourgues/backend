# Example of NodeJS backend server

Here is the general architecture of a scalable nodejs backend server:

```
docker
  ...all the Dockerfiles
src/
  entrypoints/
    console.ts
    httpserver.ts
    ...etc anything that will become a docker container
  platform/
    i18n/
    iplocation/
    cron/
    logger/
    redis/
    s3/
    socket/
    configuration/
    ...kind of the internal libs or utils that are non specific to the product, but it expose simple to use methods and classes, for instance to manipulate a s3 bucket
  services/
    gokyt/
      feature-group-1/ //When too big, sub features groups could make sense
        services/
          business-logic-service-1.ts
          business-logic-service-2.ts
        entities/
          table-a-in-db.ts
          table-b-in-db.ts
        routes.ts
        types.ts //DTOs for all this feature group, could be a folder to split in json.ts, dto.ts etc
        index.ts //expose functions used by outside, route initializer, shared functions, amqp subscriber initializer, websocket subscriber initializer
      feature-group-2/...
      index.ts //expose functions used by outside, route initializer, shared functions, amqp subscriber initializer, websocket subscriber initializer
    goscan/...
    customers/... // Some could be non-products of course when it is a large feature
    common/
      routes.ts //some common routes like dashboard could go there
      index.ts //expose functions / bridge functions from other products
    index.ts //expose functions used by outside, route initializer, shared functions, amqp subscriber initializer, websocket subscriber initializer
```

It is not allowed to call a function from another service, in fact in any folders you can only call the functions exposed in the index.ts, usually only the one:

- Exposed from /platform/\*\*\*/index.ts
- Exposed from /services/\*\*\*/index.ts

`routes.ts` can only call the current folder's services/business-logic-service-X.ts files

`entities/***.ts` can only be accessed by the nearby services/business-logic-service-X.ts files
