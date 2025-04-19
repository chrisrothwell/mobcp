import React from 'react';
import './ClassList.css';

function ClassList({ classes, onSelectClass }) {
  return (
    <div className="class-list">
      <h2>Available Classes</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th>Name</th>
            <th>Coach</th>
            <th>Duration</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {classes.map((classItem, index) => (
            <tr key={index}>
              <td>{classItem.date}</td>
              <td>{classItem.time}</td>
              <td>{classItem.name}</td>
              <td>{classItem.coach}</td>
              <td>{classItem.duration}</td>
              <td>
                <button
                  onClick={() => onSelectClass(classItem)}
                >
                  Select
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ClassList; 