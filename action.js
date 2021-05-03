const AWS = require('aws-sdk')
const fs = require('fs')
const got = require('got');
const _cliProgress = require('cli-progress');
const { performance } = require('perf_hooks');
const { CircularBuffer, humanFileSize, toHHMMSS } = require('./util')
const path = require('path');

/**
 * Project ARN on which test will run
 * @returns {string} - arn of the projecta
 */
const getProjectArn = (options) => {
    return options.projectArn;
}

/**
 * Upload file to generic url with progress bar
 * @param name - name of file printed to the console
 * @param file - filepath
 * @param url - url where to upload the file
 * @param cb - result callback (err, response) => {}
 */
const uploadFile = (name, file, url, cb) => {
    const progressBar = new _cliProgress.SingleBar({
        format: '{filename} [{bar}] {percentage}% | ETA: {eta}s | {actualLen}/{totalLen} | Speed: {speed}'
    }, _cliProgress.Presets.shades_classic);

    let receivedBytes = 0
    let lastTime = 0;
    let payload = {
        speed: "N/A",
        totalLen: "0",
        actualLen: "0",
        filename: name
    }
    let speedBuffer = new CircularBuffer(30);
    const stats = fs.statSync(file)

    let req = got.put(url, {
        isStream: true,
        body: fs.createReadStream(file)
    })
    req.on("request", (req) => {
            payload.totalLen = humanFileSize(stats.size);
            progressBar.start(stats.size, 0, payload);
        })
        .on("response", (response) => {
            progressBar.stop();
            if(response.statusCode === 200) {
                cb(null, response)
            } else {
                cb({
                    message: `Upload failed, code: ${response.statusCode}`,
                    response: response
                })
            }
        })
        .resume()
        .on("uploadProgress", progress => {
            let diff = progress.transferred - receivedBytes;
            receivedBytes = progress.transferred;
            let dt = performance.now() - lastTime;
            lastTime = performance.now();
            if(dt > 0) {
                speedBuffer.add(diff*1000.0/dt);
                payload.speed = humanFileSize(speedBuffer.avg())+"/s";
            }
            payload.actualLen = humanFileSize(receivedBytes);
            progressBar.update(receivedBytes, payload);
        })
        .on("error", (err) => {
            cb(err)
        })
        .on("close", () => {
            cb({
                message: "Connection closed"
            })
        })
}

/**
 * Run test and wait for the results
 * @param devicefarm - device farm object
 * @param options - options passed from cmd
 * @param devicePool - device pool used for the tests
 * @param apkUpload - apk upload object from getUpload
 * @param testUpload - test package object from getUpload
 * @param testSpecUpload - test spec object from getUpload
 * @param callback - callback for results (err, result) => {}
 */
const scheduleRun = (devicefarm, options, devicePool, apkUpload, testUpload, testSpecUpload, callback) => {
    const params = {
        projectArn: getProjectArn(options),
        test: {
            type: "APPIUM_NODE",
            testPackageArn: testUpload.arn,
            testSpecArn: testSpecUpload.arn
        },
        appArn: apkUpload.arn,
        configuration: {
            billingMethod: "METERED",
            location: {
                latitude: 50.073658, /* required */
                longitude: 14.418540 /* required */
            },
            radios: {
                bluetooth: true,
                gps: true,
                nfc: true,
                wifi: true
            }
        },
        devicePoolArn: devicePool.arn,
        executionConfiguration: {
            accountsCleanup: true,
            appPackagesCleanup: true,
            jobTimeoutMinutes: '60',
            skipAppResign: true,
            videoCapture: true
        },
        name: 'Github action test'
    };

    // start test
    devicefarm.scheduleRun(params, function(err, data) {
        if(err) {
            callback(err);
            return;
        }
        if(options.waitForRunComplete === false) {
            callback(null, data);
            return;
        }

        const arnParam = {
            arn: data.run.arn
        }

        let startTime = new Date().getTime()

        // periodically watch until completed
        const checkRun = () => {
            devicefarm.getRun(arnParam, (err, data) => {
                if(err) {
                    callback(err);
                    return;
                }

                let runtime = new Date().getTime() - startTime;
                console.log(toHHMMSS(runtime/1000), "status:", data.run.status, "result:", data.run.result);
                if(data.run.status === "COMPLETED") {
                    callback(null, data);
                    return;
                }
                setTimeout(checkRun, 1000);
            })
        }
        checkRun();
    });
}

/**
 * Upload file to the AWS and return Upload result with ARN information
 * When suggestArn is passed to the function, use that and skip file upload
 * @param suggestArn - arn of already existing file if you want to use that
 * @param devicefarm - device farm object
 * @param params - getUpload params
 * @param filepath - path to the file we want to upload
 * @param callback - callback function for results
 */
const upload = (suggestArn, devicefarm, params, filepath, callback) => {
    if(suggestArn !== undefined && suggestArn !== null && suggestArn !== "") {
        devicefarm.getUpload({ arn: suggestArn}, (err, data) => {
            if (err) {
                callback(err);
                return;
            }
            if(data.upload.status !== "SUCCEEDED") {
                callback({
                    message: "Upload file is not complete",
                    upload: data.upload
                });
                return;
            }
            callback(null, data);
        });
        return;
    }

    // when name is not specified, generate from filepath
    if(params.name === undefined || params.name === null || params.name === "") {
        const filename = path.basename(filepath);
        params.name = `ga_${Date.now()}_${filename}`;
    }

    devicefarm.createUpload(params, (err, data) => {
        if(err) {
            callback(err);
            return;
        }
        if(data.upload.status === "INITIALIZED") {
            uploadFile(params.name, filepath, data.upload.url, (err, response) => {
                if(err) {
                    callback(err);
                    return;
                }
                const uploadParams = {
                    arn: data.upload.arn
                };
                // Now we need to wait until upload succeeded
                let checkUpload = () => {
                    devicefarm.getUpload(uploadParams, (err, data) => {
                        if(err) {
                            callback(err);
                            return;
                        }
                        console.log("Upload", params.name, "status", data.upload.status)
                        if(data.upload.status === "PROCESSING" || data.upload.status === "INITIALIZED") {
                            // check again
                            setTimeout(checkUpload, 1000);
                            return;
                        }
                        if(data.upload.status === "FAILED") {
                            callback({
                                message: "Failed upload",
                                upload: data.upload
                            });
                            return;
                        }
                        if(data.upload.status === "SUCCEEDED") {
                            callback(null, data);
                            return;
                        }
                        // should not happen
                        callback({
                            message: `Unhandled status: ${data.upload.status}`,
                            upload: data.upload
                        });
                    })
                }
                checkUpload();
            })
        } else {
            callback({
                message: `Upload state not initialized: ${data.upload.status}`,
                upload: data.upload
            })
        }
    })
}

/**
 * Select device pool from already defined pool in the web interface
 * see: https://us-west-2.console.aws.amazon.com/devicefarm/home?region=us-east-2#/projects/26338d03-adfd-4ebc-8ce6-a6aab1e99771/settings/device-pools
 *
 * Function picks first device pool in the list that contains "github" keyword
 * eg. [github] Android 10
 * this is used for changing the device pool used in the test only from web interface
 *
 * @param devicefarm
 * @param options - options from cmd
 * @param callback - result of the pick (err, pool) => {}, when no pool contains github keyword error is returned
 */
const pickDevicePool = (devicefarm, options, callback) => {
    const params = {
        type: "PRIVATE",
        arn: getProjectArn(options)
    };
    devicefarm.listDevicePools(params, function(err, data) {
        if(err) {
            callback(err);
            return;
        }
        let pool = null;
        let poolCount = 0;
        if(Array.isArray(data.devicePools)) {
            poolCount = data.devicePools.length;
            // iterate all pool names and find first with github keyword
            for(let i = 0; i !== data.devicePools.length; ++i) {
                let p = data.devicePools[i];
                if(p.name.indexOf("github") !== -1) {
                    pool = p;
                    break;
                }
            }
        }
        if(pool === null) {
            callback({
                message: `No pool containing "github" in name found, total pools: ${poolCount}`,
                data: data
            });
            return;
        }
        callback(null, pool);
    });
}

/**
 * Main entrypoint for running the tests
 * @param options
 * @param awsOptions
 * @param failcb - callback when something fails (err) => {}
 */
const execute = (options, awsOptions, failcb) => {

    if(options.waitForRunComplete === undefined || options.waitForRunComplete === null) {
        options.waitForRunComplete = false;
    } else {
        if(options.waitForRunComplete !== false) {
            options.waitForRunComplete = true
        }
    }

    const devicefarm = new AWS.DeviceFarm(awsOptions);

    const afterUpload = (apkUpload, testUpload, testSpecUpload) => {
        // 1. Pick device pool
        // 2. Schedule and wait for run to end
        pickDevicePool(devicefarm, options, (err, devicePool) => {
            if(err) {
                failcb(err);
                return;
            }

            console.log("running on")
            console.log(`    apk=${apkUpload.name}, arn=${apkUpload.arn}`);
            console.log(`    testPackage=${testUpload.name}, arn=${testUpload.arn}`);
            console.log(`    testSpec=${testSpecUpload.name}, arn=${testSpecUpload.arn}`);
            console.log(`    pool=${devicePool.name}, arn=${devicePool.arn}`);

            scheduleRun(devicefarm, options, devicePool, apkUpload, testUpload, testSpecUpload, (err, data) => {
                if(err) {
                    failcb(err);
                    return;
                }
                if(options.waitForRunComplete === true) {
                    console.log("done", data.run.counters);
                    if(data.run.counters.total !== data.run.counters.passed) {
                        failcb({
                            message: "Some tests failed",
                            data: data
                        });
                    }
                } else {
                    console.log("started", data.run);
                }
                // And we are DONE. process will exit with code 0
                process.exit(0);
            })

        });
    }


    // 1. Upload apk
    // 2. Upload test package
    // 3. Upload test spec
    // Get upload ARNs// upload APK
    upload(options.apkArn, devicefarm, {
        type: "ANDROID_APP",
        projectArn: getProjectArn(options)
    }, options.apkPath, (err, apkUploadData) => {
        if(err) {
            failcb(err)
            return;
        }
        // Upload test
        upload(options.testArn, devicefarm, {
            type: "APPIUM_NODE_TEST_PACKAGE",
            projectArn: getProjectArn(options)
        }, options.testPath, (err, testUploadData) => {
            if(err) {
                failcb(err)
                return;
            }
            // Upload test spec
            upload(options.testSpecArn, devicefarm, {
                type: "APPIUM_NODE_TEST_SPEC",
                projectArn: getProjectArn(options)
            }, options.testSpecPath, (err, testSpecUploadData) => {
                if(err) {
                    failcb(err)
                    return;
                }
                afterUpload(apkUploadData.upload, testUploadData.upload, testSpecUploadData.upload);
            })
        })
    })
}

module.exports = execute