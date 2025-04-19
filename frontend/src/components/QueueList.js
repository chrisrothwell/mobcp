import React from 'react';
import './QueueList.css';

function QueueList({ queue, onRemoveFromQueue }) {
  return (
    <div className="queue-list">
      <h2>Current Queue</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th>Name</th>
            <th>Username</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(queue).map(([nid, item]) => (
            <tr key={nid}>
              <td>{item.classDate}</td>
              <td>{item.classTime}</td>
              <td>{item.className}</td>
              <td>{item.mboUsername}</td>
              <td>{item.pStatus || 'Pending'}</td>
              <td>
                <button
                  onClick={() => onRemoveFromQueue(nid)}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default QueueList; 