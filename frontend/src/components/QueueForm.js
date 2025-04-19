import React, { useState } from 'react';
import './QueueForm.css';

function QueueForm({ selectedClass, onAddToQueue }) {
  const [formData, setFormData] = useState({
    mboUsername: 'rothwell.chris@gmail.com',
    mboPassword: 'tFdNJE+eDJ9d+9i'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedClass) {
      onAddToQueue({
        classDate: selectedClass.date,
        classTime: selectedClass.time,
        className: selectedClass.name,
        mboUsername: formData.mboUsername,
        mboPassword: formData.mboPassword
      });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="queue-form">
      <h2>Add to Queue</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Class Date:</label>
          <input
            type="text"
            value={selectedClass?.date || ''}
            disabled
          />
        </div>
        <div className="form-group">
          <label>Class Time:</label>
          <input
            type="text"
            value={selectedClass?.time || ''}
            disabled
          />
        </div>
        <div className="form-group">
          <label>Class Name:</label>
          <input
            type="text"
            value={selectedClass?.name || ''}
            disabled
          />
        </div>
        <div className="form-group">
          <label>MBO Username:</label>
          <input
            type="text"
            name="mboUsername"
            value={formData.mboUsername}
            onChange={handleInputChange}
          />
        </div>
        <div className="form-group">
          <label>MBO Password:</label>
          <input
            type="password"
            name="mboPassword"
            value={formData.mboPassword}
            onChange={handleInputChange}
          />
        </div>
        <button type="submit" disabled={!selectedClass}>
          Add to Queue
        </button>
      </form>
    </div>
  );
}

export default QueueForm; 