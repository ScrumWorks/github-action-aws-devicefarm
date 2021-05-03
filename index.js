const core = require('@actions/core');

try {
    const awsOptions = {}
    const region = core.getInput('region');
    if(region !== undefined && region !== null) {
        awsOptions.region = region
    }
    const runOptions = {
        waitForRunComplete: core.getInput("waitForRunComplete"),
        projectArn: core.getInput('projectArn'),
        apkPath: core.getInput('apkPath'),
        testPath: core.getInput('testPath'),
        testSpecPath: core.getInput('testSpecPath'),
        apkArn: core.getInput('apkArn'),
        testArn: core.getInput('testArn'),
        testSpecArn: core.getInput('testSpecArn')
    }
    require("./action")(runOptions, awsOptions, (err) => {
        core.setFailed(err.message);
        process.exit(1)
    });
} catch (error) {
    core.setFailed(error.message);
    process.exit(1)
}