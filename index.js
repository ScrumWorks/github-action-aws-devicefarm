const core = require('@actions/core');

try {
    const region = core.getInput('region');
    const runOptions = {
        projectArn: core.getInput('projectArn'),
        apkPath: core.getInput('apkPath'),
        testPath: core.getInput('testPath'),
        testSpecPath: core.getInput('testSpecPath'),
        apkArn: core.getInput('apkArn'),
        testArn: core.getInput('testArn'),
        testSpecArn: core.getInput('testSpecArn')
    }
    require("./action")(runOptions, {
        region: region
    }, (err) => {
        core.setFailed(err.message);
        process.exit(1)
    });
} catch (error) {
    core.setFailed(error.message);
    process.exit(1)
}