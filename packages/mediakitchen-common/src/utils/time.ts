let prevRes = 0;

export function now() {
    let time = process.hrtime();
    let res = time[0] * 1000 + Math.floor(time[1] / 1000000);
    if (res < prevRes) {
        res = prevRes + 1;
    }
    prevRes = res;
    return res;
}