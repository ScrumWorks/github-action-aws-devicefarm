const AWS = require('aws-sdk')

const myArgs = process.argv.slice(2);
const testArn = myArgs[0];

const awsOptions = {
    region: "us-west-2",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY
}

const devicefarm = new AWS.DeviceFarm(awsOptions);

const collectRunLogs = (run) => {
    // Basically what to call with what arn is from here https://docs.aws.amazon.com/devicefarm/latest/developerguide/api-ref.html
    // 1. list-jobs with run.arn
    // 2. list_suites with each job.arn
    // 3. list_tests with each suite.arn
    // 4. list_artifacts with each test.arn

    devicefarm.listJobs({arn: run.arn}, (err, data) => {
        if(err) { console.log(err); return; }
        data.jobs.forEach(job => {
            devicefarm.listSuites({arn: job.arn}, (err, data) => {
                if(err) { console.log(err); return; }
                data.suites.forEach(suite => {
                    devicefarm.listTests({arn: suite.arn}, (err, data) => {
                        if(err) { console.log(err); return; }
                        data.tests.forEach(test => {
                            devicefarm.listArtifacts({type: "LOG", arn: test.arn}, (err, data) => {
                                if(err) { console.log(err); return; }
                                data.artifacts.forEach(artifact => {
                                    console.log(job.name, suite.name, test.name, artifact.name)
                                })
                            })
                        })
                    })
                })
            })
        })
    })
}

devicefarm.getRun({arn: testArn}, (err, data) => {
    collectRunLogs(data.run);
})
