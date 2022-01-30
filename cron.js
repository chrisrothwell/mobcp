
const web = require('./web.js')
const q = require('./queue.js');

async function dailySchedule() {
    const bookable = await q.getBookableQItems()

    for (booking of bookable) {
        console.log('attempting to book ', booking)
        try {
            web.book(booking)
        } catch (e) {
            console.log('Error trying to book', e)
        }
        
    }
    return bookable
}

module.exports = {dailySchedule}