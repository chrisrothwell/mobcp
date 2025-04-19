import React, { useState, useEffect } from 'react';
import ClassList from './components/ClassList';
import QueueForm from './components/QueueForm';
import QueueList from './components/QueueList';
import './App.css';

const BASE_URL = 'https://p3nk98mdn0.execute-api.ap-southeast-1.amazonaws.com/dev/';

function App() {
  const [classes, setClasses] = useState([]);
  const [queue, setQueue] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClass, setSelectedClass] = useState(null);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchClasses = async () => {
    const date = new Date(selectedDate);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const ddmmyyyy = day + month + date.getFullYear();

    try {
      const response = await fetch(`${BASE_URL}classes/${ddmmyyyy}`);
      const data = await response.json();
      setClasses(data);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const fetchQueue = async () => {
    try {
      const response = await fetch(`${BASE_URL}queue/`);
      const data = await response.json();
      setQueue(data.qd);
    } catch (error) {
      console.error('Error fetching queue:', error);
    }
  };

  const addToQueue = async (classData) => {
    try {
      await fetch(`${BASE_URL}queue/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(classData)
      });
      fetchQueue();
    } catch (error) {
      console.error('Error adding to queue:', error);
    }
  };

  const removeFromQueue = async (nid) => {
    try {
      await fetch(`${BASE_URL}queue/`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nid })
      });
      fetchQueue();
    } catch (error) {
      console.error('Error removing from queue:', error);
    }
  };

  return (
    <div className="App">
      <h1>MobCP Booking Bot</h1>
      <hr />
      
      <div className="class-selection">
        <label htmlFor="date">Select date:</label>
        <input
          type="date"
          id="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
        <button onClick={fetchClasses}>Get Classes</button>
      </div>

      <ClassList
        classes={classes}
        onSelectClass={setSelectedClass}
      />

      <QueueForm
        selectedClass={selectedClass}
        onAddToQueue={addToQueue}
      />

      <QueueList
        queue={queue}
        onRemoveFromQueue={removeFromQueue}
      />
    </div>
  );
}

export default App; 