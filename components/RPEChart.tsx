"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export interface RPEChartPoint {
  date: string;
  rpe: number;
  target?: number | null;
}

/** RPE trend line chart — loaded lazily (recharts is ~100kB) */
export default function RPEChart({ data }: { data: RPEChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} />
        <YAxis domain={[1, 10]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
        <Tooltip
          contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
          labelStyle={{ color: "#94a3b8" }}
        />
        <Line
          type="monotone"
          dataKey="rpe"
          stroke="#1D9E75"
          strokeWidth={2}
          dot={{ fill: "#1D9E75", r: 3 }}
          name="RPE effettivo"
        />
        <Line
          type="monotone"
          dataKey="target"
          stroke="#64748b"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
          name="Target"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
