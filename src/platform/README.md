This contains all the platform services.

A platform service is like a library, something that could easily be reused in another project and so is very generic.
Each platform service must expose a clear and easy-to-use index.ts file.

For instance here is the complete list of services available in a complete project:

```
amqp
analytics
bank
broker
captcha
cron
db
i18n
iplocation
ledger
lock
logger-db
push-email
push-text-message
redis
s3
socket
```

Platform services usually have this structure:

```
index.ts  --- //Exposes the functions used by outside
adapters/ --- //Depending on the configuration, the project could use different adapters. But it doesn't change the exposed functions from index.ts
  mariadb.ts
  postgresql.ts
  ...
```
