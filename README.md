# AWS Devicefarm github action

AWS documentation [task definitions](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DeviceFarm.html)

**Disclaimer**: this github action is expecting APPIUM_NODE test package and specs as an input. For different inputs fork this repo or submit pull request.

## Inputs

For the test we need to specify apk, test and testSpec files. Files can be specified with path in the repository or ARN string id of already uploaded file.

Device pool also needs to be specified, this github actions automatically picks first `PRIVATE` device pool with name that contains `*github*` somewhere in the name, see [action.js:pickDevicePool()](action.js)


**When both path and arn are specified, arn is used.**


### `projectArn`
**Required** Project ARN id, run from aws cli `aws devicefarm list-projects`

### `apkPath` or `apkArn`
**One required** Path/ARN to the app .apk file

### `testPath` or `testArn`
**One required** Path/Arn to the Appium test .zip file 

### `testSpecPath` or `testSpecArn`
**One required** Path/Arn to yml Appium test spec file

### `region` 
**Required** AWS region

### How to find ARN ids of already uploaded files
```
aws devicefarm list-uploads --arn <projectArn>
```

## Example usage
Run after `aws-actions/configure-aws-credentials` github action as
```yaml
steps:
  - name: Configure AWS credentials
    uses: aws-actions/configure-aws-credentials@v1
    with:
      aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
      aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      aws-region: us-west-2
      
  - name: Run AWS Devicefarm   
    uses: ScrumWorks/github-action-aws-devicefarm@v1
    with:
        projectArn: "<project arn>"
        
        apkPath: ./build/app.apk
        testPath: ./appium_test.zip
        testSpecFile: ./appium_spec.yml
        
        # or use ARN
        apkArn: "<apk arn>",
        testArn: "<test arn>",
        testSpecArn: "<test spec arn>"
        
        region: us-west-2
```

## Run locally
```
yarn install
AWS_ACCESS_KEY_ID=<aws-access-key-id> AWS_SECRET_KEY=<aws-secret-access-key> node index.local.js <apk path> <test path> <region>
```