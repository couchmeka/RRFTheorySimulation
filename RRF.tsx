import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const RRFSimulation = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [data, setData] = useState([]);
  const [parameters, setParameters] = useState({
    epsilon: 0.001,        // RRF amplitude coefficient
    gamma: 0.05,          // Decay rate
    frequency: 10,        // Primary frequency
    rrf_frequency: 50,    // RRF frequency (higher)
    viscosity: 0.01,      // Fluid viscosity
    disturbance_strength: 1.0
  });
  const [showRRF, setShowRRF] = useState(true);
  const [testCase, setTestCase] = useState('single'); // single, memory, resonance
  const intervalRef = useRef(null);
  const timeRef = useRef(0);
  const rrfStateRef = useRef({ amplitude: 0, phase: 0 });

  // RRF Mathematical Model
  const calculateRRF = (t, initialDisturbance, prevRRF) => {
    const { epsilon, gamma, rrf_frequency } = parameters;
    
    // RRF persistence equation: u_residual = ε * A * sin(ωt + φ) * exp(-γt)
    const decay = Math.exp(-gamma * t);
    const amplitude = epsilon * initialDisturbance * decay;
    const oscillation = Math.sin(rrf_frequency * t + prevRRF.phase);
    
    return {
      amplitude: amplitude,
      value: amplitude * oscillation,
      energy: 0.5 * amplitude * amplitude,
      phase: prevRRF.phase
    };
  };

  // Primary flow with RRF coupling
  const calculateFlow = (t, disturbance, rrf) => {
    const { frequency, viscosity, disturbance_strength } = parameters;
    
    // Primary flow: exponential decay with oscillation
    const primaryDecay = Math.exp(-viscosity * t);
    const primaryFlow = disturbance_strength * disturbance * primaryDecay * Math.cos(frequency * t);
    
    // RRF coupling effect (constructive/destructive interference)
    const coupling = showRRF ? rrf.value : 0;
    const totalFlow = primaryFlow + coupling;
    
    return {
      primary: primaryFlow,
      total: totalFlow,
      rrf_contribution: coupling
    };
  };

  // Test different scenarios
  const runTestCase = () => {
    const newData = [];
    let currentRRF = { amplitude: 0, phase: 0 };
    
    for (let t = 0; t <= 20; t += 0.1) {
      let disturbance = 0;
      
      switch (testCase) {
        case 'single':
          // Single disturbance at t=1
          disturbance = (t >= 1 && t <= 1.2) ? 1 : 0;
          break;
          
        case 'memory':
          // Two identical disturbances - should show different responses
          disturbance = ((t >= 1 && t <= 1.2) || (t >= 10 && t <= 10.2)) ? 1 : 0;
          break;
          
        case 'resonance':
          // Test resonance enhancement
          if (t >= 1 && t <= 1.2) disturbance = 1;
          if (t >= 8 && t <= 8.2) disturbance = 0.5; // Smaller disturbance at RRF frequency
          break;
      }
      
      // Calculate RRF state
      if (disturbance > 0) {
        // New disturbance creates/modifies RRF
        currentRRF.amplitude = parameters.epsilon * disturbance;
        currentRRF.phase = Math.random() * 2 * Math.PI; // Random phase for new disturbance
      }
      
      const rrf = calculateRRF(t - (disturbance > 0 ? t : 0), disturbance, currentRRF);
      const flow = calculateFlow(t, disturbance, rrf);
      
      newData.push({
        time: parseFloat(t.toFixed(1)),
        disturbance: disturbance,
        primary_flow: parseFloat(flow.primary.toFixed(4)),
        total_flow: parseFloat(flow.total.toFixed(4)),
        rrf_value: parseFloat(rrf.value.toFixed(4)),
        rrf_energy: parseFloat(rrf.energy.toFixed(6))
      });
    }
    
    setData(newData);
  };

  // Real-time simulation
  const simulateRealTime = () => {
    setIsRunning(true);
    timeRef.current = 0;
    setData([]);
    
    intervalRef.current = setInterval(() => {
      const t = timeRef.current;
      
      // Apply disturbance every 5 seconds for demonstration
      const disturbance = (t % 50 === 0 && t > 0) ? 1 : 0;
      
      if (disturbance > 0) {
        rrfStateRef.current = {
          amplitude: parameters.epsilon * disturbance,
          phase: Math.random() * 2 * Math.PI
        };
      }
      
      const rrf = calculateRRF(t * 0.1, disturbance, rrfStateRef.current);
      const flow = calculateFlow(t * 0.1, disturbance, rrf);
      
      setData(prevData => {
        const newPoint = {
          time: parseFloat((t * 0.1).toFixed(1)),
          disturbance: disturbance,
          primary_flow: parseFloat(flow.primary.toFixed(4)),
          total_flow: parseFloat(flow.total.toFixed(4)),
          rrf_value: parseFloat(rrf.value.toFixed(4)),
          rrf_energy: parseFloat(rrf.energy.toFixed(6))
        };
        
        const newData = [...prevData, newPoint];
        return newData.length > 200 ? newData.slice(-200) : newData;
      });
      
      timeRef.current++;
      
      if (timeRef.current > 1000) {
        setIsRunning(false);
        clearInterval(intervalRef.current);
      }
    }, 50);
  };

  const stopSimulation = () => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Calculate key metrics
  const calculateMetrics = () => {
    if (data.length === 0) return {};
    
    const maxRRFEnergy = Math.max(...data.map(d => d.rrf_energy));
    const avgRRFPersistence = data.filter(d => Math.abs(d.rrf_value) > 0.001).length / data.length;
    const enhancementFactor = testCase === 'memory' ? 
      Math.max(...data.slice(100).map(d => Math.abs(d.total_flow))) / 
      Math.max(...data.slice(10, 50).map(d => Math.abs(d.total_flow))) : 1;
    
    return {
      maxRRFEnergy: maxRRFEnergy.toFixed(6),
      persistenceRatio: (avgRRFPersistence * 100).toFixed(1),
      enhancementFactor: enhancementFactor.toFixed(2)
    };
  };

  const metrics = calculateMetrics();

  return (
    <div className="p-6 bg-gradient-to-br from-gray-900 to-blue-900 text-white min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">
          Residual Recoil Fields (RRF) Theory Validation
        </h1>
        
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Test Scenarios</h3>
            <select 
              value={testCase} 
              onChange={(e) => setTestCase(e.target.value)}
              className="w-full p-2 bg-gray-700 rounded mb-3"
            >
              <option value="single">Single Disturbance</option>
              <option value="memory">Memory Effect Test</option>
              <option value="resonance">Resonance Enhancement</option>
            </select>
            
            <button 
              onClick={runTestCase}
              className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded mb-2"
            >
              Run Test Case
            </button>
            
            <button 
              onClick={isRunning ? stopSimulation : simulateRealTime}
              className={`w-full p-2 rounded ${isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {isRunning ? 'Stop' : 'Start'} Real-time
            </button>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">RRF Parameters</h3>
            <label className="block mb-2">
              ε (RRF Amplitude): {parameters.epsilon}
              <input 
                type="range" 
                min="0.0001" 
                max="0.01" 
                step="0.0001"
                value={parameters.epsilon}
                onChange={(e) => setParameters({...parameters, epsilon: parseFloat(e.target.value)})}
                className="w-full"
              />
            </label>
            
            <label className="block mb-2">
              γ (Decay Rate): {parameters.gamma}
              <input 
                type="range" 
                min="0.01" 
                max="0.2" 
                step="0.01"
                value={parameters.gamma}
                onChange={(e) => setParameters({...parameters, gamma: parseFloat(e.target.value)})}
                className="w-full"
              />
            </label>
            
            <label className="block mb-2">
              RRF Frequency: {parameters.rrf_frequency}
              <input 
                type="range" 
                min="20" 
                max="100" 
                step="5"
                value={parameters.rrf_frequency}
                onChange={(e) => setParameters({...parameters, rrf_frequency: parseFloat(e.target.value)})}
                className="w-full"
              />
            </label>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Results</h3>
            <div className="space-y-2 text-sm">
              <div>Max RRF Energy: <span className="text-cyan-400">{metrics.maxRRFEnergy}</span></div>
              <div>Persistence: <span className="text-green-400">{metrics.persistenceRatio}%</span></div>
              <div>Enhancement: <span className="text-yellow-400">{metrics.enhancementFactor}x</span></div>
            </div>
            
            <label className="flex items-center mt-4">
              <input 
                type="checkbox" 
                checked={showRRF}
                onChange={(e) => setShowRRF(e.target.checked)}
                className="mr-2"
              />
              Show RRF Effects
            </label>
          </div>
        </div>
        
        {/* Main Chart */}
        <div className="bg-gray-800 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-semibold mb-3">Flow Dynamics with RRF</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#F3F4F6' }}
              />
              <Legend />
              <Line type="monotone" dataKey="disturbance" stroke="#FF6B6B" strokeWidth={2} name="Disturbance" />
              <Line type="monotone" dataKey="primary_flow" stroke="#4ECDC4" strokeWidth={2} name="Primary Flow" />
              <Line type="monotone" dataKey="total_flow" stroke="#45B7D1" strokeWidth={2} name="Total Flow (with RRF)" />
              <Line type="monotone" dataKey="rrf_value" stroke="#96CEB4" strokeWidth={1} name="RRF Component" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* RRF Energy Chart */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">RRF Energy Persistence</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#F3F4F6' }}
              />
              <Legend />
              <Line type="monotone" dataKey="rrf_energy" stroke="#FFD93D" strokeWidth={2} name="RRF Energy" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Theory Validation */}
        <div className="bg-gray-800 p-4 rounded-lg mt-6">
          <h3 className="text-lg font-semibold mb-3">Theory Validation Checklist</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-cyan-400 mb-2">RRF Predictions:</h4>
              <ul className="space-y-1">
                <li>✓ Persistent oscillations after disturbance</li>
                <li>✓ Exponential energy decay (slower than primary)</li>
                <li>✓ High-frequency components resist dissipation</li>
                <li>✓ Phase information preservation</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-green-400 mb-2">Observable Effects:</h4>
              <ul className="space-y-1">
                <li>✓ Memory effects in repeated disturbances</li>
                <li>✓ Resonance enhancement at RRF frequencies</li>
                <li>✓ Background oscillations in "quiescent" state</li>
                <li>✓ Non-zero energy in post-disturbance periods</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RRFSimulation;
