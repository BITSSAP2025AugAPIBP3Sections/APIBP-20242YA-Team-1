import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface AnalyticsChartProps {
  title: string;
  type: "bar" | "line" | "pie";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  dataKey?: string;
  xAxisKey?: string;
  colors?: string[];
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const resolveCssVarColor = (color: string) => {
  if (typeof window === "undefined") {
    return color;
  }

  const match = color.match(/var\((--[^)]+)\)/);
  if (!match) {
    return color;
  }

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(match[1])
    .trim();

  return value ? color.replace(match[0], value) : color;
};

export function AnalyticsChart({
  title,
  type,
  data,
  dataKey = "value",
  xAxisKey = "name",
  colors = CHART_COLORS,
}: AnalyticsChartProps) {
  const resolvedColors = useMemo(
    () => colors.map((color) => resolveCssVarColor(color)),
    [colors]
  );

  const renderChart = () => {
    if (type === "bar") {
      return (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey={xAxisKey} className="text-sm" />
          <YAxis className="text-sm" />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
            }}
          />
          <Legend />
          <Bar dataKey={dataKey} fill={resolvedColors[0]} radius={[4, 4, 0, 0]} />
        </BarChart>
      );
    }
    
    if (type === "line") {
      return (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey={xAxisKey} className="text-sm" />
          <YAxis className="text-sm" />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={resolvedColors[0]}
            strokeWidth={2}
            dot={{ fill: resolvedColors[0] }}
          />
        </LineChart>
      );
    }
    
    return (
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={(entry) => entry.name}
          outerRadius={100}
          fill="#8884d8"
          dataKey={dataKey}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={resolvedColors[index % resolvedColors.length]}
            />
          ))}
        </Pie>
      </PieChart>
    );
  };

  return (
    <Card className="p-6" data-testid={`chart-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        {renderChart()}
      </ResponsiveContainer>
    </Card>
  );
}
