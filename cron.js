
const web = require('./web.js')
const q = require('./queue.js');

async function dailySchedule() {
    const bookable = await q.getBookableQItems()
    console.log(bookable)    

    for (booking in bookable) {
        console.log('attempting to book ', booking)
        web.book(booking)
    }
    return bookable
}

module.exports = {dailySchedule}