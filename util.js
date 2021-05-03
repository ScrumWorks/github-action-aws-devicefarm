const toHHMMSS = function (str) {
    let sec_num = parseInt(str, 10); // don't forget the second param
    let hours   = Math.floor(sec_num / 3600);
    let minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    let seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    return hours+':'+minutes+':'+seconds;
}


function humanFileSize(bytes, si=false, dp=1) {
    const thresh = si ? 1000 : 1024;

    if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }

    const units = si
        ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
        : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let u = -1;
    const r = 10**dp;

    do {
        bytes /= thresh;
        ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);


    return bytes.toFixed(dp) + ' ' + units[u];
}

class CircularBuffer {
    constructor(max) {
        this.i = 0
        this.max = max
        this.vals = [];
        for(let i = 0; i !== max; ++i) this.vals.push(0);
    }

    add(val) {
        this.vals[this.i] = val;
        this.i = (this.i+1)%this.max;
    }

    avg() {
        let cm = 0;
        for(let i = 0; i !== this.max; ++i) {
            cm += this.vals[i];
        }
        return cm/this.max
    }
}

module.exports = {
    CircularBuffer,
    humanFileSize,
    toHHMMSS
}