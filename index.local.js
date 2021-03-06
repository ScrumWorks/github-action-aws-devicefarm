/**
 * Index for running action locally
 */
const myArgs = process.argv.slice(2);

const runOptions = {
    projectArn: myArgs[0],
    apkPath: myArgs[1],
    testPath: myArgs[2],
    testSpecArn:  myArgs[3],
    waitForRunComplete: false
}

require("./action")(runOptions, {
    region: "us-west-2",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY
}, (err) => {
    console.log(err, err.stack);
});
