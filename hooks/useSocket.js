// @ts-check

import { useEffect, useState } from "react";
import { io } from "socket.io-client";

/**
 * @returns {import("socket.io-client").Socket | null}
 */
export const useSocket = () => {
    const [socket, setSocket] = useState(
        /** @type {import("socket.io-client").Socket | null} */(null)
    );

    useEffect(() => {
        const socketInstance = io("http://localhost:3001");

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, []);

    return socket;
};