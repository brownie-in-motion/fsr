import { useCallback, useEffect, useState } from "react";

type SerialState =
  | { status: "disconnected" }
  | { status: "connecting" }
  | {
      status: "connected";
      port: SerialPort;
      read: ReadableStreamDefaultReader<string>;
      write: WritableStreamDefaultWriter<string>;
      close: Promise<void>;
    }
  | { status: "failed"; error: string };

export const useSerial = () => {
  const [state, setState] = useState<SerialState>({ status: "disconnected" });
  const [message, setMessage] = useState<string[]>([]);

  const connect = useCallback(async () => {
    if (!("serial" in navigator)) {
      setState({
        status: "failed",
        error: "Browser not supported. Are you using Chrome or Edge?",
      });
      return;
    }

    setState({ status: "connecting" });

    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      if (port.readable && port.writable) {
        const readEncoder = new TextDecoderStream();
        const writeEncoder = new TextEncoderStream();
        const readClose = port.readable.pipeTo(readEncoder.writable);
        const writeClose = writeEncoder.readable.pipeTo(port.writable);
        setState({
          status: "connected",
          port,
          read: readEncoder.readable.getReader(),
          write: writeEncoder.writable.getWriter(),
          close: Promise.race([
            readClose,
            writeClose,
          ]).then(() => {
            port.close();
          }),
        })

        port.addEventListener("disconnect", () => {
          setState({ status: "disconnected" });
        })
      } else {
        throw new Error("Port is not readable or writable.");
      }
    } catch (error) {
      console.log(error);
      setState({ status: "failed", error: "Could not connect to port." });
    }
  }, []);

  const write = useCallback(
    async (data: string) => {
      if (state.status === "connected") {
        await state.write.write(data);
      }
    },
    [state]
  );

  useEffect(() => {
    let data = '';
    (async () => {
      if (state.status === "connected") {
        while (true) {
          const { value, done } = await state.read.read();
          if (value) {
            const split = (data + value).split("\n");
            data = split.pop() || "";
            setMessage(split);
          }
          if (done) break;
        }
      }
    })();

    return () => {
      if (state.status === "connected") {
        state.port.close();
      }
    }
  }, [state]);

  return {
    state,
    connect,
    write,
    message,
  };
};
