
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ChartDataPoint {
  time: string;
  value: number;
  value2?: number;
}

interface ChartDisplayProps {
  data: ChartDataPoint[];
  title: string;
  color?: string;
  color2?: string;
  yAxisLabel?: string;
  unit?: string;
}

export function ChartDisplay({ 
  data, 
  title, 
  color = '#3b82f6',
  color2 = '#10b981',
  yAxisLabel = '',
  unit = ''
}: ChartDisplayProps) {
  // Format time for display
  const formatTime = (time: string) => {
    const date = new Date(time);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height={250}>
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="time" 
            tickFormatter={formatTime}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={{ stroke: '#e5e7eb' }}
            label={{ 
              value: yAxisLabel,
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle', fontSize: 12, fill: '#6b7280' }
            }}
          />
          <Tooltip
            formatter={(value, name) => {
              // Custom labels for dual lines
              const label = name === 'value' ? (data[0]?.value2 !== undefined ? 'RX' : title) : 'TX';
              return [`${Number(value).toFixed(2)} ${unit}`, label];
            }}
            labelFormatter={formatTime}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
            labelStyle={{ fontWeight: 'bold', fontSize: 12, color: '#374151' }}
          />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: color, stroke: 'white', strokeWidth: 2 }}
            animationDuration={500}
            name="value"
          />
          {/* Secondary Line for TX (if exists) */}
          {data.length > 0 && data[0].value2 !== undefined && (
            <Line 
              type="monotone" 
              dataKey="value2" 
              stroke={color2} 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: color2, stroke: 'white', strokeWidth: 2 }}
              animationDuration={500}
              name="value2"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
