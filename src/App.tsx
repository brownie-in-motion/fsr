import "@mantine/core/styles.css";

import { useEffect, useState } from "react";
import { useSerial } from "./serial";
import { Container, Slider } from "@mantine/core";
import {
  IconSquareArrowDownFilled,
  IconSquareArrowLeftFilled,
  IconSquareArrowRightFilled,
  IconSquareArrowUpFilled,
} from "@tabler/icons-react";
import { useLocalStorage } from "@mantine/hooks";

type SensorValues = {
  up: number;
  down: number;
  left: number;
  right: number;
};

const App = () => {
  const [target, setTarget] = useLocalStorage({
    key: "levels",
    defaultValue: {
      up: 0,
      down: 0,
      left: 0,
      right: 0,
    },
  });

  const { message, state, connect, write } = useSerial();
  const [levels, setLevels] = useState({
    up: 0,
    down: 0,
    left: 0,
    right: 0,
  });
  const [thresholds, setThresholds] = useState<SensorValues | null>(null);

  useEffect(() => {
    if (state.status !== "connected") return;
    (async () => {
      await Promise.all(
        (["up", "left", "down", "right"] as const).map((d, i) => {
          if (!thresholds || thresholds[d] !== target[d]) {
            return write(`${i} ${target[d]}\n`);
          }
          return Promise.resolve();
        }),
      );
    })();
  }, [state.status, write, target, thresholds]);

  const set = (v: number, direction: "up" | "down" | "left" | "right") => {
    setTarget((prev) => {
      return {
        ...prev,
        [direction]: v,
      };
    });
  };

  useEffect(() => {
    for (const m of message) {
      const parsed = m.split(" ");
      if (parsed.length === 5) {
        const [c, u, l, d, r] = parsed;
        if ([u, d, l, r].every((v) => !isNaN(parseInt(v)))) {
          if (c === "v") {
            setLevels({
              up: parseInt(u),
              down: parseInt(d),
              left: parseInt(l),
              right: parseInt(r),
            });
            continue;
          }
          if (c === "t") {
            setThresholds({
              up: parseInt(u),
              down: parseInt(d),
              left: parseInt(l),
              right: parseInt(r),
            });
            continue;
          }
        }
        console.log("unhandled", message);
      }
    }
  }, [message]);

  useEffect(() => {
    const timer = setInterval(() => {
      write("v\n");
    }, 10);
    return () => clearInterval(timer);
  }, [write]);

  const content = (() => {
    switch (state.status) {
      case "disconnected":
        return <button onClick={connect}>Connect</button>;
      case "connecting":
        return <>Connecting...</>;
      case "connected":
        return (
          <div>
            {(
              [
                ["left", IconSquareArrowLeftFilled],
                ["down", IconSquareArrowDownFilled],
                ["up", IconSquareArrowUpFilled],
                ["right", IconSquareArrowRightFilled],
              ] as const
            ).map(([direction, Icon]) => (
              // icon next to all 3 sliders
              <div
                key={direction}
                style={{ display: "flex", alignItems: "center", width: "100%" }}
              >
                <Icon
                  size={60}
                  color={
                    (thresholds?.[direction] ?? 0) < levels[direction]
                      ? "green"
                      : "black"
                  }
                />
                <div style={{ flexGrow: 1 }}>
                  <Slider
                    value={target[direction]}
                    onChange={(v) => set(v, direction)}
                    min={0}
                    max={1000}
                  />
                  <Slider
                    disabled
                    value={thresholds?.[direction] ?? 0}
                    min={0}
                    max={1000}
                  />
                  <Slider
                    disabled
                    value={levels[direction]}
                    min={0}
                    max={1000}
                  />
                </div>
              </div>
            ))}
          </div>
        );
      case "failed":
        return (
          <>
            <div>Failed to connect: {state.error}</div>
            <button onClick={connect}>Try again</button>
          </>
        );
    }
  })();

  return <Container p="md">{content}</Container>;
};

export default App;
