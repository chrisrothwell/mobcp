const BASE_URL = 'https://p3nk98mdn0.execute-api.ap-southeast-1.amazonaws.com/dev/'

function fetchClasses() {
    document.getElementById("classBtn").disabled=true
    document.getElementById("classes").innerText = ""
    let currentdate = new Date(document.getElementById("ddmmyyyy").value)
    day = currentdate.getDate()
    month = currentdate.getMonth() + 1
    if (day < 10) { daystr = '0' + day }
    if (month < 10) { monthstr = '0' + month }
    ddmmyyyy = daystr + monthstr + currentdate.getFullYear()
    fetch(BASE_URL + 'classes/' + ddmmyyyy)
    .then(response => response.json())
    .then(classes => showClasses(classes));
}

function showClasses(classes) {
    document.getElementById("classBtn").disabled=false
    const classDiv = document.querySelector('#classes')
    let counter = 0
    classes.forEach(e => {
        const thisClass = document.createElement('tr')
        thisClass.innerHTML = `
            <td>${e.date}</td>
            <td>${e.time}</td>
            <td>${e.name}</td>
            <td>${e.coach}</td>
            <td>${e.duration}</td>
            <td>${e.slots}</td>
            <td><button type="button" id="popForm${counter}" onclick="popForm('${e.date}', '${e.time}', '${e.name}')">Populate Form</button></td>
        `
        classDiv.append(thisClass)
        counter++
    })
}

function popForm(date, time, name) {
    document.getElementById("cdate").value=date
    document.getElementById("ctime").value=time
    document.getElementById("cname").value=name
}

function addToQueue() {
    qdate = document.getElementById("cdate").value
    qtime = document.getElementById("ctime").value
    qname = document.getElementById("cname").value
    qun = document.getElementById("mboUn").value
    qpw = document.getElementById("mboPw").value

    fetch(BASE_URL + 'queue/', {
        method: "POST",
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            classDate: qdate,
            classTime: qtime,
            className: qname,
            mboUsername: qun,
            mboPassword: qpw
        })
    }).then(res => {
        console.log("Post complete! response:", res)
    })
}

function fetchQueue() {
    document.getElementById("showQueueBtn").disabled=true
    document.getElementById("queue").innerText = ""
    fetch(BASE_URL + 'queue/')
    .then(response => response.json())
    .then(qitems => showQueue(qitems.qd));
}

function showQueue(queue) {
    document.getElementById("showQueueBtn").disabled=false
    const classDiv = document.querySelector('#queue')
    for (qitem of Object.keys(queue)) {
        console.log()
        const thisQueue = document.createElement('tr')
        thisQueue.innerHTML = `
            <td>${queue[qitem].classDate}</td>
            <td>${queue[qitem].classTime}</td>
            <td>${queue[qitem].className}</td>
            <td>${queue[qitem].mboUsername}</td>
            <td>${queue[qitem].mboPassword}</td>
            <td>${queue[qitem].nid}</td>
            <td>${queue[qitem].pStatus}</td>
            <td><button type="button" id="removeFromQueue${queue[qitem].nid}" onclick="removeFromQueue('${queue[qitem].nid}')">Remove</button></td>
        `
        classDiv.append(thisQueue)
    }
}

function onLoad() {
    let today = new Date()
    document.getElementById("ddmmyyyy").valueAsDate = today
}