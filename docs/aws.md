# AWS installation

The AWS adapter observes crawler requests through CloudFront real-time logs. Its SAM template creates
a Kinesis stream, CloudFront delivery role, real-time log configuration, Lambda consumer, and event
source mapping.

Install and copy the built adapter:

```sh
npm install --save-dev "github:Steve-And-Fay/public-internet-crafters-client#v0.3.0"
npx ic-client install aws --target ./infrastructure
sam build --template-file infrastructure/internet-crafters-analytics-aws/template.yaml
sam deploy --guided
```

The deploy asks for the existing distribution ID, portal ingest URL, site token, and sampling rate.
The token is a `NoEcho` CloudFormation parameter and becomes a Lambda environment variable; it does
not enter CloudFront logs or browser code.

The stack intentionally does not mutate an existing distribution. After deployment, attach the
`RealtimeLogConfigArn` output to the default cache behavior and any additional cache behaviors that
should be observed. CloudFront accepts that ARN in each behavior's `RealtimeLogConfigArn` field.

CloudFront real-time log field order is contractual. If the template fields change, update
`IC_CLOUDFRONT_LOG_FIELDS` in the same order. A lower sampling rate reduces cost but the resulting
counts are sampled, not exact.

Use the reusable server wrapper described in [error capture](error-capture.md) for customer Lambda
or Node application failures. CloudFront log collection alone sees responses, not thrown exceptions.

## Check this document against

- `platforms/aws/template.yaml`
- `src/aws/cloudfront.ts`
- `src/aws/handler.ts`
- `scripts/build-portable.mjs`
