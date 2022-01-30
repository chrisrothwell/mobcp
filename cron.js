
const web = require('./web.js')
const q = require('./queue.js');

async function dailySchedule() {
    const bookable = await q.getBookableQItems()
    let promiseArray = []
    let promiseResult

    for (booking of bookable) {
        console.log('adding to promise array ', booking)
        promiseArray.push(web.book(booking))
    }

    console.log('running the following functions in parallel', promiseArray, 'length', promiseArray.length)

    if (promiseArray.length > 0) {
        promiseResult = await Promise.all(promiseArray)
        console.log('Finished running all bookings ', promiseResult)
    } else {
        console.log('No promises to run')
        throw new Error('No classes to book.')
    }

    return promiseResult
}

module.exports = {dailySchedule}