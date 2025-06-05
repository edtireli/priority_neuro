import React, {createContext, useState} from "react";

export const NotificationContext = createContext();

export const NotificationProvider = ({children}) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = (notification) => {
    setNotifications((prev) => [...prev, notification]);
  };

  const remove = (index) => {
    setNotifications((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <NotificationContext.Provider value={{ addNotification }}>
      {children}
      {notifications.map((n, i) => (
        <div
          key={i}
          className={`snackbar ${n.severity || ""}`}
          onAnimationEnd={() => remove(i)}
        >
          {n.message}
        </div>
      ))}
    </NotificationContext.Provider>
  );
};
