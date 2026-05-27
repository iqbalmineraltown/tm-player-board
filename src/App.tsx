/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  playClickSound, 
  playProductionSuccess, 
  playAlertKlaxon 
} from './audio';
import { GameState, ResourceId, LogEntry, ActiveTab, ResourceState } from './types';
import TelemetryChart from './components/TelemetryChart';

// Initial state parameters matched to the exact mockup values
const INITIAL_STATE: GameState = {
  generation: 1,
  terraformRating: 20,
  resources: {
    megacredits: { inventory: 45, production: 12 },
    steel: { inventory: 8, production: 3 },
    titanium: { inventory: 2, production: 1 },
    plants: { inventory: 14, production: 4 },
    energy: { inventory: 6, production: 6 },
    heat: { inventory: 18, production: 2 },
  },
  oxygen: 5, // 5% matching mockup
  temperature: -18, // -18°C matching mockup
  oceans: 3, // 3/9 oceans matching mockup
  milestones: {
    terraformer: false,
    mayor: false,
    gardener: false,
    builder: false,
    planner: false,
  }
};

// Initial system logs matching mockup
const INITIAL_LOGS: LogEntry[] = [
  {
    id: 'init-1',
    generation: 1,
    timestamp: new Date().toISOString(),
    message: 'System initialization secure. Mars Environmental Command online.',
    type: 'system',
  },
  {
    id: 'init-2',
    generation: 1,
    timestamp: new Date().toISOString(),
    message: 'Grid synchronization established on telemetry Uplink.',
    type: 'system',
  },
  {
    id: 'init-3',
    generation: 1,
    timestamp: new Date().toISOString(),
    message: 'Sector TR-20 production cycles active. Generation 01 initiated.',
    type: 'production',
  }
];

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>('command');
  
  // Game state history for persistent Undo / Redo
  const [history, setHistory] = useState<GameState[]>(() => {
    const cached = localStorage.getItem('tf_game_history');
    if (cached) {
      try { return JSON.parse(cached); } catch(_) { /* fallback */ }
    }
    return [INITIAL_STATE];
  });
  
  const [historyIndex, setHistoryIndex] = useState<number>(() => {
    const cachedIdx = localStorage.getItem('tf_history_index');
    if (cachedIdx) {
      try { return parseInt(cachedIdx, 10); } catch(_) { /* fallback */ }
    }
    return 0;
  });

  const [logs, setLogs] = useState<LogEntry[]>(() => {
    const cachedLogs = localStorage.getItem('tf_logs');
    if (cachedLogs) {
      try { return JSON.parse(cachedLogs); } catch(_) { /* fallback */ }
    }
    return INITIAL_LOGS;
  });

  // Global step multiplier for all resource adjustments (x1, x5, x10)
  const [globalStep, setGlobalStep] = useState<number>(1);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // Auto-close alert after 4 seconds
  useEffect(() => {
    if (alertMessage) {
      const timer = setTimeout(() => setAlertMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [alertMessage]);

  // Controls UI for general adjustments and automation
  const [autoTRRule, setAutoTRRule] = useState<boolean>(true); // Auto increase TR on global parameter gains
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>('');
  const [importError, setImportError] = useState<string>('');

  // Active State helper
  const currentState = history[historyIndex] || INITIAL_STATE;

  // Persist states across browser reloads
  useEffect(() => {
    localStorage.setItem('tf_game_history', JSON.stringify(history));
    localStorage.setItem('tf_history_index', historyIndex.toString());
    localStorage.setItem('tf_logs', JSON.stringify(logs));
  }, [history, historyIndex, logs]);

  // Unified state pusher with undo boundaries
  const pushState = (newState: GameState, logMsg?: { text: string; type: LogEntry['type'] }) => {
    const newHistory = history.slice(0, historyIndex + 1);
    setHistory([...newHistory, newState]);
    setHistoryIndex(newHistory.length);

    if (logMsg) {
      const entry: LogEntry = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        generation: newState.generation,
        timestamp: new Date().toLocaleTimeString(),
        message: logMsg.text,
        type: logMsg.type,
      };
      setLogs(prev => [entry, ...prev].slice(0, 500)); // Limit logs size
    }
  };

  // Undo / Redo mechanics
  const handleUndo = () => {
    if (historyIndex > 0) {
      playClickSound(400, 0.08, 'sawtooth');
      setHistoryIndex(prev => prev - 1);
      
      const revertedState = history[historyIndex - 1];
      const entry: LogEntry = {
        id: `undo-${Date.now()}`,
        generation: revertedState.generation,
        timestamp: new Date().toLocaleTimeString(),
        message: 'Reverted action: System parameters restored to former state.',
        type: 'system',
      };
      setLogs(prev => [entry, ...prev]);
    } else {
      playAlertKlaxon();
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      playClickSound(800, 0.08, 'sine');
      setHistoryIndex(prev => prev + 1);
      
      const restate = history[historyIndex + 1];
      const entry: LogEntry = {
        id: `redo-${Date.now()}`,
        generation: restate.generation,
        timestamp: new Date().toLocaleTimeString(),
        message: 'Re-applied action: Telemetry record re-synchronized.',
        type: 'system',
      };
      setLogs(prev => [entry, ...prev]);
    } else {
      playAlertKlaxon();
    }
  };

  // Resource incremental adjustments
  const adjustResource = (rid: ResourceId, type: 'inventory' | 'production', amount: number) => {
    playClickSound(amount > 0 ? 650 : 500, 0.05);
    const newResources = JSON.parse(JSON.stringify(currentState.resources));
    const current = newResources[rid][type];
    
    // Limits
    const minLimit = rid === 'megacredits' && type === 'production' ? -5 : 0;
    const maxLimit = 999;
    const nextVal = Math.min(maxLimit, Math.max(minLimit, current + amount));

    if (nextVal !== current) {
      newResources[rid][type] = nextVal;
      const stepSymbol = rid.toUpperCase().split('_')[0];
      const logText = `${stepSymbol} ${type} changed by ${amount >= 0 ? '+' : ''}${amount} (New: ${nextVal})`;
      
      pushState(
        { ...currentState, resources: newResources },
        { text: logText, type: 'adjust' }
      );
    }
  };

  // Global game variables adjustments (+ checks)
  const adjustParameter = (param: 'oxygen' | 'temperature' | 'oceans' | 'terraformRating', increment: boolean) => {
    const newState = { ...currentState };
    let logMsg = '';
    let autoTRAdded = false;

    if (param === 'oxygen') {
      const prev = newState.oxygen;
      newState.oxygen = increment ? Math.min(14, prev + 1) : Math.max(0, prev - 1);
      if (newState.oxygen !== prev) {
        playClickSound(700, 0.06);
        logMsg = `Atmospheric oxygen adjusted: ${newState.oxygen}%`;
        // Standard rule: oxygen increases also raise TR by 1
        if (increment && autoTRRule && newState.terraformRating < 100) {
          newState.terraformRating += 1;
          autoTRAdded = true;
        }
      }
    } else if (param === 'temperature') {
      const tempRange = [-30, -28, -26, -24, -22, -20, -18, -16, -14, -12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8];
      const currentIdx = tempRange.indexOf(newState.temperature);
      if (currentIdx !== -1) {
        const nextIdx = increment ? Math.min(tempRange.length - 1, currentIdx + 1) : Math.max(0, currentIdx - 1);
        const nextVal = tempRange[nextIdx];
        if (nextVal !== newState.temperature) {
          playClickSound(750, 0.06);
          newState.temperature = nextVal;
          logMsg = `Core temperature adjusted: ${newState.temperature}°C`;
          if (increment && autoTRRule && newState.terraformRating < 100) {
            newState.terraformRating += 1;
            autoTRAdded = true;
          }
        }
      }
    } else if (param === 'oceans') {
      const prev = newState.oceans;
      newState.oceans = increment ? Math.min(9, prev + 1) : Math.max(0, prev - 1);
      if (newState.oceans !== prev) {
        playClickSound(680, 0.06);
        logMsg = `Hydrological reservoirs adjusted: ${newState.oceans}/9 oceans`;
        if (increment && autoTRRule && newState.terraformRating < 100) {
          newState.terraformRating += 1;
          autoTRAdded = true;
        }
      }
    } else if (param === 'terraformRating') {
      const prev = newState.terraformRating;
      newState.terraformRating = increment ? Math.min(100, prev + 1) : Math.max(0, prev - 1);
      if (newState.terraformRating !== prev) {
        playClickSound(550, 0.07);
        logMsg = `Terraform Rating (TR) calibrated to ${newState.terraformRating}`;
      }
    }

    if (logMsg) {
      if (autoTRAdded) {
        logMsg += ` (TR auto-increased by +1)`;
      }
      pushState(newState, { text: logMsg, type: 'parameter' });
    } else {
      playAlertKlaxon();
    }
  };

  // Claim game board milestones
  const toggleMilestone = (milestoneKey: keyof GameState['milestones']) => {
    const newState = { ...currentState, milestones: { ...currentState.milestones } };
    const currentVal = newState.milestones[milestoneKey];
    
    // Deduct 8 credits when claiming a milestone, and give it back if unclaiming
    const cost = 8;
    const currentMC = newState.resources.megacredits.inventory;

    if (!currentVal) {
      // Claiming
      if (currentMC < cost) {
        playAlertKlaxon();
        setAlertMessage(`INSUFFICIENT MEGACREDITS. Claiming a project milestone requires ${cost} M_CREDITS.`);
        return;
      }
      playProductionSuccess();
      newState.milestones[milestoneKey] = true;
      newState.resources.megacredits.inventory = currentMC - cost;
      
      const msg = `Milestone CLAIMED: ${milestoneKey.toUpperCase()} (Paid -${cost} Megacredits)`;
      pushState(newState, { text: msg, type: 'milestone' });
    } else {
      // Unclaiming (restores cost)
      playClickSound(400, 0.05);
      newState.milestones[milestoneKey] = false;
      newState.resources.megacredits.inventory = Math.min(999, currentMC + cost);

      const msg = `Milestone RELEASED: ${milestoneKey.toUpperCase()} (Refunded +${cost} Megacredits)`;
      pushState(newState, { text: msg, type: 'milestone' });
    }
  };

  // Convert resources shortcut actions
  const executeShortcutConvert = (type: 'greenery' | 'thermal') => {
    const newState = JSON.parse(JSON.stringify(currentState)) as GameState;
    let success = false;
    let logText = '';

    if (type === 'greenery') {
      const prevPlants = newState.resources.plants.inventory;
      if (prevPlants >= 8) {
        playProductionSuccess();
        newState.resources.plants.inventory = prevPlants - 8;
        newState.oxygen = Math.min(14, newState.oxygen + 1);
        newState.terraformRating = Math.min(100, newState.terraformRating + 1);
        logText = `BIO-MATTER CONVERSION: Spent 8 Bio-matter. Installed Greenery. Oxygen increases to ${newState.oxygen}% and TR rises +1.`;
        success = true;
      }
    } else if (type === 'thermal') {
      const prevHeat = newState.resources.heat.inventory;
      if (prevHeat >= 8) {
        playProductionSuccess();
        newState.resources.heat.inventory = prevHeat - 8;
        
        // Temperature range step
        const tempRange = [-30, -28, -26, -24, -22, -20, -18, -16, -14, -12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8];
        const currentIdx = tempRange.indexOf(newState.temperature);
        if (currentIdx !== -1 && currentIdx < tempRange.length - 1) {
          newState.temperature = tempRange[currentIdx + 1];
          newState.terraformRating = Math.min(100, newState.terraformRating + 1);
          logText = `THERMAL CONVERSION: Spent 8 Thermal energy. Core heat raised to ${newState.temperature}°C. TR rises +1.`;
          success = true;
        } else {
          // Heat is capped, but still deducts or blocks? Standard rules: can be converted until temp is maxed.
          playAlertKlaxon();
          setAlertMessage('Core temperature has reached planetary threshold (+8°C). Conversion bypassed.');
          return;
        }
      }
    }

    if (success) {
      pushState(newState, { text: logText, type: 'parameter' });
    } else {
      playAlertKlaxon();
      const lacking = type === 'greenery' ? 'Plants (Bio-matter)' : 'Heat (Thermal)';
      setAlertMessage(`INSUFFICIENT RESOURCES. You need at least 8 units of ${lacking} to execute thermodynamic molecular conversion.`);
    }
  };

  // standard Projects Console purchase actions
  const executeStandardProject = (prj: 'power' | 'asteroid' | 'aquifer' | 'greenery' | 'city') => {
    const newState = JSON.parse(JSON.stringify(currentState)) as GameState;
    const currentMC = newState.resources.megacredits.inventory;
    let cost = 0;
    let detail = '';

    switch(prj) {
      case 'power':
        cost = 11;
        if (currentMC >= cost) {
          newState.resources.energy.production += 1;
          detail = `Installed Power Grid. PWR_GRID production increased (+1).`;
        }
        break;
      case 'asteroid':
        cost = 14;
        if (currentMC >= cost) {
          // Temperature raise
          const tempRange = [-30, -28, -26, -24, -22, -20, -18, -16, -14, -12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8];
          const currIdx = tempRange.indexOf(newState.temperature);
          if (currIdx < tempRange.length - 1) {
            newState.temperature = tempRange[currIdx + 1];
            newState.terraformRating = Math.min(100, newState.terraformRating + 1);
            detail = `Busted asteroid collision. Temperature core raised to ${newState.temperature}°C. TR increased (+1).`;
          } else {
            setAlertMessage('Core temperature fully maxed. Select a different project.');
            return;
          }
        }
        break;
      case 'aquifer':
        cost = 18;
        if (currentMC >= cost) {
          if (newState.oceans < 9) {
            newState.oceans += 1;
            newState.terraformRating = Math.min(100, newState.terraformRating + 1);
            detail = `Hydraulic excavation. Ocean water level index at ${newState.oceans}/9. TR increased (+1).`;
          } else {
            setAlertMessage('Planetary hydrology optimized. Water body count maxed out.');
            return;
          }
        }
        break;
      case 'greenery':
        cost = 23;
        if (currentMC >= cost) {
          if (newState.oxygen < 14) {
            newState.oxygen += 1;
            newState.terraformRating = Math.min(100, newState.terraformRating + 1);
            detail = `Automated flora planting. Atmospheric Oxygen saturation reaches ${newState.oxygen}%. TR increased (+1).`;
          } else {
            setAlertMessage('Atmosphere fully saturated with Oxygen (14%). Flora projects capped.');
            return;
          }
        }
        break;
      case 'city':
        cost = 25;
        if (currentMC >= cost) {
          newState.resources.megacredits.production += 1;
          detail = `Civic hub dome structural assembly complete. Megacredits production gained (+1).`;
        }
        break;
    }

    if (detail && cost > 0) {
      playProductionSuccess();
      newState.resources.megacredits.inventory = currentMC - cost;
      pushState(newState, { 
        text: `STANDARD PROJECT EXECUTED: Bought "${prj.toUpperCase()}" for ${cost} Megacredits. ${detail}`, 
        type: 'parameter' 
      });
    } else {
      playAlertKlaxon();
      setAlertMessage(`LACKING FUNDING. Executing standard ${prj.toUpperCase()} project assembly requires ${cost} credits.`);
    }
  };

  // Execution algorithm for production cycle (INIT_PRODUCTON / NEXT GENERATION)
  const executeProductionCycles = () => {
    playProductionSuccess();

    const nextState = JSON.parse(JSON.stringify(currentState)) as GameState;
    const oldGen = nextState.generation;

    // 1. Convert leftovers energy into Heat
    const leftoverEnergy = nextState.resources.energy.inventory;
    const oldHeat = nextState.resources.heat.inventory;
    nextState.resources.heat.inventory = Math.min(999, oldHeat + leftoverEnergy);

    // 2. Megacredit revenue generation = TR + MC production
    const mcIncome = Math.max(0, nextState.terraformRating + nextState.resources.megacredits.production);
    nextState.resources.megacredits.inventory = Math.min(999, nextState.resources.megacredits.inventory + mcIncome);

    // 3. Energy gets set to its production value
    nextState.resources.energy.inventory = nextState.resources.energy.production;

    // 4. Generate all other resources from production
    nextState.resources.steel.inventory = Math.min(999, nextState.resources.steel.inventory + nextState.resources.steel.production);
    nextState.resources.titanium.inventory = Math.min(999, nextState.resources.titanium.inventory + nextState.resources.titanium.production);
    nextState.resources.plants.inventory = Math.min(999, nextState.resources.plants.inventory + nextState.resources.plants.production);
    nextState.resources.heat.inventory = Math.min(999, nextState.resources.heat.inventory + nextState.resources.heat.production);

    // 5. Advance Generation
    nextState.generation = oldGen + 1;

    // Detailed report for history console logs
    const detailedLog = `GENERATION ${oldGen} COMPLETED. ➔ Applied planetary yield. Megacredits revenue: +${mcIncome} (TR ${nextState.terraformRating} + Production ${nextState.resources.megacredits.production}). Transferred ${leftoverEnergy} Energy to THERMAL reserve. Produced: Steel (+${nextState.resources.steel.production}), Titanium (+${nextState.resources.titanium.production}), Bio-matter (+${nextState.resources.plants.production}), Power-grid (+${nextState.resources.energy.production}), Thermal (+${nextState.resources.heat.production}).`;

    pushState(nextState, { text: detailedLog, type: 'production' });
  };

  // Reboot command (hard erase)
  const handleFullReset = () => {
    playAlertKlaxon();
    setHistory([INITIAL_STATE]);
    setHistoryIndex(0);
    setLogs([
      {
        id: `reset-${Date.now()}`,
        generation: INITIAL_STATE.generation,
        timestamp: new Date().toLocaleTimeString(),
        message: 'planetary purge completed. Telemetry and inventory registers cleared to launch status.',
        type: 'reset',
      },
      ...INITIAL_LOGS
    ]);
    setShowResetModal(false);
  };

  // Uplink Import System
  const triggerStateImport = () => {
    try {
      const parsed = JSON.parse(importText);
      if (parsed.generation && parsed.resources && parsed.resources.megacredits) {
        // validate minimal payload
        const verifiedState = {
          ...INITIAL_STATE,
          ...parsed,
        };
        setHistory([verifiedState]);
        setHistoryIndex(0);
        setLogs([
          {
            id: `import-${Date.now()}`,
            generation: verifiedState.generation,
            timestamp: new Date().toLocaleTimeString(),
            message: 'External state payload successfully retrieved and integrated via high-gain Uplink.',
            type: 'system',
          },
          ...logs
        ]);
        setImportError('');
        setShowExportModal(false);
        setImportText('');
        playProductionSuccess();
      } else {
        setImportError('INVALID STRUCT. Standard game indices missing in uploaded JSON.');
        playAlertKlaxon();
      }
    } catch(e) {
      setImportError('MALFORMED PAYLOAD. JSON syntax compile error.');
      playAlertKlaxon();
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background bg-grid-pattern transition-all duration-300 flex flex-col md:flex-row">
      
      {/* Dynamic Floating Toast Alerts overlay */}
      <AnimatePresence>
        {alertMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.95 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[calc(100%-2rem)] bg-red-950/95 border-2 border-red-500 text-red-100 px-4 py-3 shadow-2xl flex items-start gap-3 rounded-lg backdrop-blur-md"
          >
            <span className="material-symbols-outlined text-red-500 animate-pulse flex-shrink-0">warning</span>
            <div className="flex-1 text-xs font-mono leading-relaxed text-left">
              <div className="font-bold uppercase tracking-wider text-red-400 mb-0.5 text-[10px]">ALERT KLAXON</div>
              {alertMessage}
            </div>
            <button 
              onClick={() => setAlertMessage(null)}
              className="text-red-400 hover:text-white transition-colors p-1 flex-shrink-0"
            >
              <span className="material-symbols-outlined text-xs">close</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 1. SIDEBAR (Left on desktop, top navigation bar collapsible on mobile) */}
      <nav className="w-full md:w-64 bg-surface-container border-b-4 md:border-b-0 md:border-r-4 border-outline-industrial flex flex-col flex-shrink-0 z-40 transition-colors duration-300 relative">
        {/* Physical hardware look accent screws */}
        <div className="absolute top-2 left-2 screw opacity-45"></div>
        <div className="absolute top-2 right-2 screw opacity-45"></div>
        <div className="hidden md:block absolute bottom-2 left-2 screw opacity-45"></div>
        <div className="hidden md:block absolute bottom-2 right-2 screw opacity-45"></div>

        {/* Branding & Major Action */}
        <div className="p-4 md:p-6 border-b-2 border-outline-industrial">
          <div className="flex justify-between items-center mb-1">
            <h1 className="font-display font-bold text-xl tracking-widest text-primary">SYS_CMD</h1>
            <span className="font-mono text-[10px] uppercase text-outline px-1.5 py-0.5 bg-surface-container-lowest border border-outline-variant">
              SECURE
            </span>
          </div>

          <div className="hazard-stripes h-1 px-4 mt-2 mb-4"></div>

          {/* TR_20 Card display */}
          <div className="grid grid-cols-2 gap-2 mb-4 bg-surface-container-low border border-outline-variant p-2">
            <div className="flex flex-col justify-center border-r border-outline-variant pr-2">
              <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">TE_RATING</span>
              <div className="flex items-center gap-1 mt-1 justify-between">
                <span className="font-display text-lg font-bold text-primary">TR_{currentState.terraformRating}</span>
                <div className="flex flex-col gap-0.5">
                  <button 
                    onClick={() => adjustParameter('terraformRating', true)}
                    className="w-5 h-5 bg-surface-container-highest hover:bg-outline-variant text-white text-xs border border-outline-industrial flex items-center justify-center.5"
                  >
                    +
                  </button>
                  <button 
                    onClick={() => adjustParameter('terraformRating', false)}
                    className="w-5 h-5 bg-surface-container-highest hover:bg-outline-variant text-white text-xs border border-outline-industrial flex items-center justify-center.5"
                  >
                    -
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center pl-2">
              <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">EPOCH_GEN</span>
              <span className="font-display text-xl font-bold text-tertiary mt-1">GEN_{currentState.generation}</span>
            </div>
          </div>

          {/* INIT PRODUCTION Lever */}
          <button
            onClick={executeProductionCycles}
            className="w-full text-center relative overflow-hidden group py-3 px-4 bg-status-heat text-white border-2 border-red-950 font-display font-bold uppercase text-xs tracking-widest transition-transform duration-100 hover:scale-[1.01] active:scale-[0.99] shadow-md hover:brightness-110 active:brightness-95"
            id="btn-init-prod"
          >
            <div className="absolute inset-0 bg-red-600 hazard-stripes opacity-10 group-hover:opacity-15 transition-opacity pointer-events-none"></div>
            <span className="relative z-10 select-none">INIT_PRODUCTION</span>
          </button>
        </div>

        {/* Tab Buttons Navigation */}
        <ul className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible border-b md:border-b-0 border-outline-variant">
          {(['command', 'prod_sys', 'milestones', 'sys_log', 'manual'] as const).map((tab) => {
            const isActive = activeTab === tab;
            const labels: Record<string, string> = {
              command: 'COMMAND_UI',
              prod_sys: 'PROD_SYS',
              milestones: 'MILESTONES',
              sys_log: 'SYS_LOGS',
              manual: 'GUIDE_MANUAL',
            };
            const icons: Record<string, string> = {
              command: 'dashboard',
              prod_sys: 'query_stats',
              milestones: 'emoji_events',
              sys_log: 'history_edu',
              manual: 'menu_book',
            };

            return (
              <li key={tab} className="flex-1 md:flex-initial">
                <button
                  onClick={() => {
                    playClickSound(620, 0.04);
                    setActiveTab(tab);
                  }}
                  className={`w-full flex items-center md:justify-start gap-3 px-4 py-3 md:py-3.5 text-xs font-mono tracking-widest transition-all text-center md:text-left ${
                    isActive
                      ? 'bg-surface-container-highest text-primary border-b-2 md:border-b-0 md:border-l-4 border-primary font-bold shadow-inner'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px] select-none">{icons[tab]}</span>
                  <span className="hidden sm:inline-block text-[10px] uppercase">{labels[tab]}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Outer Utilities - manual theme & connection */}
        <div className="mt-auto hidden md:flex flex-col p-4 border-t border-outline-variant gap-2 bg-surface-container-low">
          <div className="flex gap-2 w-full">
            <button
              onClick={() => {
                playClickSound(500, 0.05);
                setShowExportModal(true);
              }}
              className="flex-1 py-1.5 text-[10px] border border-outline-industrial text-on-surface-variant hover:text-on-surface font-mono uppercase bg-surface-container-low hover:bg-surface-container flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-xs">sync_alt</span> Uplink
            </button>
            <button
              onClick={() => {
                playClickSound(600, 0.05);
                const html = document.documentElement;
                html.classList.toggle('dark');
              }}
              className="flex-1 py-1.5 text-[10px] border border-outline-industrial text-on-surface-variant hover:text-on-surface font-mono uppercase bg-surface-container-low hover:bg-surface-container flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-xs">settings_brightness</span> Optics
            </button>
          </div>
          <button
            onClick={() => {
              playClickSound(300, 0.4);
              setShowResetModal(true);
            }}
            className="w-full py-2 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-400 dark:border-red-500/50 hover:border-red-600 dark:hover:border-red-500 hover:text-red-800 dark:hover:text-red-300 font-mono text-[10px] rounded uppercase flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">warning</span> SYSTEM PURGE / REBOOT
          </button>
          <div className="flex items-center gap-2 justify-center py-2 border-t border-outline-variant mt-2">
            <span className="indicator-light text-green-500 animate-pulse bg-current"></span>
            <span className="text-[9px] font-mono tracking-wider text-slate-500 uppercase select-none">
              offline-ready secure console
            </span>
          </div>
        </div>
      </nav>

      {/* 2. MAIN WORKSPACE CONTENT */}
      <main className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        
        {/* UPPER NAVIGATION BAR FOR MOBILE ONLY (Import, Optics) */}
        <div className="flex md:hidden justify-between items-center bg-surface-container p-2 border border-outline-variant mb-4 rounded-sm gap-2">
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1 bg-surface-container-low hover:bg-surface-container border border-outline-variant px-3 py-1 text-xs font-mono rounded"
          >
            <span className="material-symbols-outlined text-[14px]">sync_alt</span>
            Uplink
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const html = document.documentElement;
                html.classList.toggle('dark');
              }}
              className="flex items-center gap-1 bg-surface-container-low hover:bg-surface-container border border-outline-variant px-3 py-1 text-xs font-mono rounded"
            >
              <span className="material-symbols-outlined text-[14px]">settings_brightness</span>
              Theme
            </button>
            <button
              onClick={() => {
                playClickSound(300, 0.4);
                setShowResetModal(true);
              }}
              className="p-1 px-3 border border-red-500 hover:border-red-600 text-red-700 dark:text-red-300 font-bold rounded text-xs font-mono flex items-center gap-1 bg-red-100/50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/70 active:scale-95 transition-transform"
              title="Reset everything for a new game"
            >
              <span className="material-symbols-outlined text-[14px]">warning</span> PURGE
            </button>
          </div>
        </div>

        {/* Global Parameter Controls Panel (Persistent across Tab selections so players can monitor stats) */}
        <section className="mb-4 md:mb-6 industrial-panel p-3 md:p-4">
          <div className="absolute top-2 left-2 screw opacity-40"></div>
          <div className="absolute top-2 right-2 screw opacity-40"></div>
          <div className="absolute bottom-2 left-2 screw opacity-40"></div>
          <div className="absolute bottom-2 right-2 screw opacity-40"></div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-outline-industrial pb-2 mb-3 gap-2">
            <h2 className="font-display text-xs tracking-widest text-primary flex items-center gap-1.5 font-bold uppercase">
              <span className="material-symbols-outlined text-yellow-500 text-sm">warning</span>
              GLOBAL_PARAMETERS
            </h2>
            <div className="flex items-center gap-2 select-none">
              <input
                id="auto-tr-checkbox"
                type="checkbox"
                checked={autoTRRule}
                onChange={(e) => setAutoTRRule(e.target.checked)}
                className="w-3.5 h-3.5 bg-surface-container-low border-outline text-primary focus:ring-0 rounded-sm cursor-pointer"
              />
              <label htmlFor="auto-tr-checkbox" className="font-mono text-[9px] text-on-surface-variant uppercase cursor-pointer">
                Auto-increment TR on parameter gain
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            {/* O2 */}
            <div className="bg-surface-container-lowest p-2.5 border border-outline-variant flex flex-col gap-1.5 rounded-sm relative">
              <div className="flex justify-between items-center font-mono text-[9px] sm:text-[10px] text-on-surface-variant">
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-status-oxygen text-sm">air</span> ATM_OXYGEN</span>
                <span className={`${currentState.oxygen === 14 ? 'text-green-400 font-bold' : 'text-status-oxygen'} font-mono`}>
                  {currentState.oxygen.toString().padStart(2, '0')}% / 14%
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => adjustParameter('oxygen', false)}
                  className="w-8 h-8 md:w-7 md:h-7 bg-surface-container-highest hover:bg-outline-variant border border-outline-industrial text-on-surface rounded-sm flex items-center justify-center font-bold text-sm active:scale-90 transition-transform"
                  title="Decrease Oxygen"
                >
                  -
                </button>
                <div className="flex-1 bg-surface-container h-2.5 border border-outline-variant rounded-sm overflow-hidden relative shadow-inner">
                  <div 
                    className="bg-status-oxygen h-full transition-all duration-300"
                    style={{ width: `${(currentState.oxygen / 14) * 100}%` }}
                  />
                  {/* Tick Dividers */}
                  <div className="absolute inset-0 flex justify-between px-[2px] pointer-events-none opacity-20">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className="w-px h-full bg-background" />
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => adjustParameter('oxygen', true)}
                  className="w-8 h-8 md:w-7 md:h-7 bg-surface-container-highest hover:bg-outline-variant border border-outline-industrial text-on-surface rounded-sm flex items-center justify-center font-bold text-sm active:scale-90 transition-transform"
                  title="Increase Oxygen"
                >
                  +
                </button>
              </div>
            </div>

            {/* TEMP */}
            <div className="bg-surface-container-lowest p-2.5 border border-outline-variant flex flex-col gap-1.5 rounded-sm relative">
              <div className="flex justify-between items-center font-mono text-[9px] sm:text-[10px] text-on-surface-variant">
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-status-heat text-sm">thermostat</span> TEMP_CORE</span>
                <span className={`${currentState.temperature === 8 ? 'text-green-400 font-bold' : 'text-status-heat'} font-mono`}>
                  {currentState.temperature >= 0 ? '+' : ''}{currentState.temperature}°C / +08°C
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => adjustParameter('temperature', false)}
                  className="w-8 h-8 md:w-7 md:h-7 bg-surface-container-highest hover:bg-outline-variant border border-outline-industrial text-on-surface rounded-sm flex items-center justify-center font-bold text-sm active:scale-90 transition-transform"
                  title="Decrease Temperature"
                >
                  -
                </button>
                <div className="flex-1 bg-surface-container h-2.5 border border-outline-variant rounded-sm overflow-hidden relative shadow-inner">
                  {/* -30°C to +8°C is 38 degrees range */}
                  <div 
                    className="bg-status-heat h-full transition-all duration-300"
                    style={{ width: `${((currentState.temperature + 30) / 38) * 100}%` }}
                  />
                  <div className="absolute inset-0 flex justify-between px-[2px] pointer-events-none opacity-20">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="w-px h-full bg-background" />
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => adjustParameter('temperature', true)}
                  className="w-8 h-8 md:w-7 md:h-7 bg-surface-container-highest hover:bg-outline-variant border border-outline-industrial text-on-surface rounded-sm flex items-center justify-center font-bold text-sm active:scale-90 transition-transform"
                  title="Increase Temperature"
                >
                  +
                </button>
              </div>
            </div>

            {/* OCEANS */}
            <div className="bg-surface-container-lowest p-2.5 border border-outline-variant flex flex-col gap-1.5 rounded-sm relative">
              <div className="flex justify-between items-center font-mono text-[9px] sm:text-[10px] text-on-surface-variant">
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-secondary text-sm">water_drop</span> OCEANS_H2O</span>
                <span className={`${currentState.oceans === 9 ? 'text-green-400 font-bold' : 'text-secondary'} font-mono`}>
                  {currentState.oceans.toString().padStart(2, '0')} / 09
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => adjustParameter('oceans', false)}
                  className="w-8 h-8 md:w-7 md:h-7 bg-surface-container-highest hover:bg-outline-variant border border-outline-industrial text-on-surface rounded-sm flex items-center justify-center font-bold text-sm active:scale-90 transition-transform"
                  title="Remove Ocean"
                >
                  -
                </button>
                {/* Segmented display matching layout */}
                <div className="flex-1 flex gap-1 h-2.5">
                  {Array.from({ length: 9 }).map((_, idx) => {
                    const isFilled = idx < currentState.oceans;
                    return (
                      <div
                        key={idx}
                        className={`flex-1 rounded-sm border border-outline-variant/35 transition-colors ${
                          isFilled 
                            ? 'bg-secondary' 
                            : 'bg-surface-container-low'
                        }`}
                      />
                    );
                  })}
                </div>
                <button
                  onClick={() => adjustParameter('oceans', true)}
                  className="w-8 h-8 md:w-7 md:h-7 bg-surface-container-highest hover:bg-outline-variant border border-outline-industrial text-on-surface rounded-sm flex items-center justify-center font-bold text-sm active:scale-90 transition-transform"
                  title="Place Ocean"
                >
                  +
                </button>
              </div>
            </div>

          </div>
        </section>

        {/* 3. TABS VIEWS SWITCH CONTAINER */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* ======================= COMMAND UI TAB ======================== */}
            {activeTab === 'command' && (
              <div className="flex-1 flex flex-col gap-4 md:gap-6">
                
                {/* Header row with undo/redo buttons */}
                <div className="flex justify-between items-center border-b border-outline-industrial pb-2">
                  <h3 className="font-display text-xs tracking-widest text-[#ece0dd] uppercase font-semibold">
                    INV_MAINFRAME
                  </h3>
                  
                  {/* Tool actions panel */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleUndo}
                      disabled={historyIndex === 0}
                      className="metal-button w-9 h-8 flex items-center justify-center disabled:opacity-30 disabled:hover:border-outline-industrial"
                      title="Undo action"
                    >
                      <span className="material-symbols-outlined text-[16px]">undo</span>
                    </button>
                    <button
                      onClick={handleRedo}
                      disabled={historyIndex >= history.length - 1}
                      className="metal-button w-9 h-8 flex items-center justify-center disabled:opacity-30 disabled:hover:border-outline-industrial"
                      title="Redo action"
                    >
                      <span className="material-symbols-outlined text-[16px]">redo</span>
                    </button>
                  </div>
                </div>

                {/* Unified Master Scale Steps Bar */}
                <div className="flex flex-row justify-between items-center gap-2 bg-surface-container-low border border-outline-variant p-2 sm:p-2.5 rounded-lg">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">
                    <span className="material-symbols-outlined text-sm text-primary">tune</span>
                    <span className="hidden xs:inline">ADJUST STEP:</span>
                    <span className="xs:hidden">STEP:</span>
                  </div>
                  <div className="flex bg-surface-container-lowest border border-outline-industrial rounded overflow-hidden">
                    {([1, 5, 10] as const).map((v) => {
                      const isCurrent = globalStep === v;
                      return (
                        <button
                          key={v}
                          onClick={() => {
                            playClickSound(900, 0.02);
                            setGlobalStep(v);
                          }}
                          className={`px-3 py-1 font-mono text-xs font-bold transition-all ${
                            isCurrent
                              ? 'bg-primary text-on-primary font-black shadow-inner'
                              : 'text-on-surface-variant hover:bg-surface-container-high'
                          }`}
                        >
                          x{v}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 6-Card resource database structure */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {(Object.keys(currentState.resources) as ResourceId[]).map((rKey) => {
                    const resource = currentState.resources[rKey];

                    // Resource details definitions
                    const config: Record<ResourceId, { name: string; icon: string; color: string; prdColor: string }> = {
                      megacredits: { name: 'M_CREDITS', icon: 'monetization_on', color: 'text-tertiary', prdColor: 'text-tertiary' },
                      steel: { name: 'STEEL_ALLOY', icon: 'construction', color: 'text-secondary', prdColor: 'text-secondary' },
                      titanium: { name: 'TITANIUM', icon: 'diamond', color: 'text-outline', prdColor: 'text-outline' },
                      plants: { name: 'BIO_MATTER', icon: 'eco', color: 'text-status-plants', prdColor: 'text-status-plants' },
                      energy: { name: 'PWR_GRID', icon: 'bolt', color: 'text-status-energy', prdColor: 'text-status-energy' },
                      heat: { name: 'THERMAL', icon: 'local_fire_department', color: 'text-status-heat', prdColor: 'text-status-heat' },
                    };

                    const cfg = config[rKey];

                    return (
                      <div
                        key={rKey}
                        className="resource-card p-3 rounded-lg border border-outline bg-surface-container flex flex-col gap-2 md:gap-3 transition-colors relative"
                        data-resource={rKey}
                      >
                        {/* Screws on modular grid plates */}
                        <div className="absolute top-1 left-1 screw opacity-20"></div>
                        <div className="absolute top-1 right-1 screw opacity-20"></div>
                        <div className="absolute bottom-1 left-1 screw opacity-20"></div>
                        <div className="absolute bottom-1 right-1 screw opacity-20"></div>

                        {/* Card Header (Resource ID and Micro Production Controller) */}
                        <div className="flex justify-between items-center z-10">
                          <span className={`${cfg.color} font-mono text-[11px] font-bold tracking-wider flex items-center gap-1.5 select-none uppercase`}>
                            <span className="material-symbols-outlined text-[15px]">{cfg.icon}</span>
                            {cfg.name}
                          </span>
                        </div>

                        {/* Interactive Symmetrical double-bar layout */}
                        <div className="grid grid-cols-2 gap-2 z-10">
                          
                          {/* INVENTORY PANEL */}
                          <div className="bg-surface-container-low p-1.5 md:p-2 rounded border border-outline-variant/30 flex flex-col items-center">
                            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1 select-none">STOCK</span>
                            <div className="flex items-center justify-between w-full gap-0.5 sm:gap-1">
                              <button
                                onClick={() => adjustResource(rKey, 'inventory', -globalStep)}
                                className="w-8 h-8 rounded bg-surface-container-highest hover:bg-outline-variant text-[#ffdad3] border border-outline-industrial flex items-center justify-center font-bold text-sm transition-transform active:scale-90"
                                title={`Subtract ${globalStep} Stock`}
                              >
                                -
                              </button>
                              <span className="font-display font-black text-lg md:text-xl text-white text-center flex-1">
                                {resource.inventory}
                              </span>
                              <button
                                onClick={() => adjustResource(rKey, 'inventory', globalStep)}
                                className="w-8 h-8 rounded bg-surface-container-highest hover:bg-outline-variant text-[#ffdad3] border border-outline-industrial flex items-center justify-center font-bold text-sm transition-transform active:scale-90"
                                title={`Add ${globalStep} Stock`}
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* PRODUCTION PANEL */}
                          <div className="bg-surface-container-low p-1.5 md:p-2 rounded border border-outline-variant/30 flex flex-col items-center">
                            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1 select-none">PROD</span>
                            <div className="flex items-center justify-between w-full gap-0.5 sm:gap-1">
                              <button
                                onClick={() => adjustResource(rKey, 'production', -globalStep)}
                                className="w-8 h-8 rounded bg-surface-container-highest hover:bg-outline-variant text-[#ffdad3] border border-outline-industrial flex items-center justify-center font-bold text-sm transition-transform active:scale-90"
                                title={`Subtract ${globalStep} Production`}
                              >
                                -
                              </button>
                              <span className={`${cfg.prdColor} font-display font-black text-lg md:text-xl text-center flex-1`}>
                                {resource.production >= 0 ? '+' : ''}{resource.production}
                              </span>
                              <button
                                onClick={() => adjustResource(rKey, 'production', globalStep)}
                                className="w-8 h-8 rounded bg-surface-container-highest hover:bg-outline-variant text-[#ffdad3] border border-outline-industrial flex items-center justify-center font-bold text-sm transition-transform active:scale-90"
                                title={`Add ${globalStep} Production`}
                              >
                                +
                              </button>
                            </div>
                          </div>

                        </div>

                        {/* Custom companion fast shortcut actions direct under specific cards */}
                        {rKey === 'plants' && (
                          <div className="pt-1.5 border-t border-outline-variant/25 flex justify-end z-10">
                            <button
                              onClick={() => executeShortcutConvert('greenery')}
                              className="w-full text-center text-[9px] font-mono border border-status-plants bg-status-plants/5 text-status-plants py-1.5 rounded-sm hover:bg-status-plants/15 uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-95"
                            >
                              <span className="material-symbols-outlined text-[11px]">forest</span>
                              BUY GREENERY [-8 Plants]
                            </button>
                          </div>
                        )}

                        {rKey === 'heat' && (
                          <div className="pt-1.5 border-t border-outline-variant/25 flex justify-end z-10">
                            <button
                              onClick={() => executeShortcutConvert('thermal')}
                              className="w-full text-center text-[9px] font-mono border border-status-heat bg-status-heat/5 text-status-heat py-1.5 rounded-sm hover:bg-status-heat/15 uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-95"
                            >
                              <span className="material-symbols-outlined text-[11px]">local_fire_department</span>
                              RAISE CORE TEMP [-8 Heat]
                            </button>
                          </div>
                        )}
                        
                      </div>
                    );
                  })}
                </div>

                {/* Companion Action Deck: standard projects list */}
                <div className="industrial-panel p-4 mt-2">
                  <div className="absolute top-2 left-2 screw opacity-30"></div>
                  <div className="absolute top-2 right-2 screw opacity-30"></div>
                  <div className="absolute bottom-2 left-2 screw opacity-30"></div>
                  <div className="absolute bottom-2 right-2 screw opacity-30"></div>

                  <h3 className="font-display text-xs text-primary font-bold tracking-widest uppercase border-b border-outline-variant pb-2 mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">build</span> Standard Projects console
                  </h3>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    <button
                      onClick={() => executeStandardProject('power')}
                      className="metal-button py-2.5 px-2 text-[10px] rounded hover:border-status-energy/50 flex flex-col items-center gap-1 transition-all"
                    >
                      <span className="font-bold text-status-energy">POWER PLANT (11 MC)</span>
                      <span className="text-[8px] text-slate-400 font-normal">PWR_GRID Production +1</span>
                    </button>
                    <button
                      onClick={() => executeStandardProject('asteroid')}
                      className="metal-button py-2.5 px-2 text-[10px] rounded hover:border-status-heat/50 flex flex-col items-center gap-1 transition-all"
                    >
                      <span className="font-bold text-status-heat">ASTEROID (14 MC)</span>
                      <span className="text-[8px] text-slate-400 font-normal">Temp Raised +2°C, TR +1</span>
                    </button>
                    <button
                      onClick={() => executeStandardProject('aquifer')}
                      className="metal-button py-2.5 px-2 text-[10px] rounded hover:border-secondary/50 flex flex-col items-center gap-1 transition-all"
                    >
                      <span className="font-bold text-[#7bd0ff]">AQUIFER (18 MC)</span>
                      <span className="text-[8px] text-slate-400 font-normal">Place Ocean, TR +1</span>
                    </button>
                    <button
                      onClick={() => executeStandardProject('greenery')}
                      className="metal-button py-2.5 px-2 text-[10px] rounded hover:border-status-plants/50 flex flex-col items-center gap-1 transition-all"
                    >
                      <span className="font-bold text-[#4ade80]">GREENERY (23 MC)</span>
                      <span className="text-[8px] text-slate-400 font-normal">Oxygen Raised +1%, TR +1</span>
                    </button>
                    <button
                      onClick={() => executeStandardProject('city')}
                      className="metal-button py-2.5 px-2 text-[10px] rounded hover:border-tertiary/50 flex flex-col items-center gap-1 transition-all"
                    >
                      <span className="font-bold text-[#ece0dd]">CITY DOME (25 MC)</span>
                      <span className="text-[8px] text-slate-400 font-normal">M_CREDITS Production +1</span>
                    </button>
                  </div>
                </div>

                {/* SYS STREAM LIVE LOGGER PANEL */}
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex justify-between items-center border-b border-outline-industrial pb-2">
                    <span className="font-display text-xs font-bold uppercase text-on-surface-variant tracking-wider flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">history_edu</span> Local telemetry stream
                    </span>
                    <button 
                      onClick={() => setActiveTab('sys_log')}
                      className="text-[10px] font-mono text-primary hover:underline hover:text-white"
                    >
                      EXPAND DIRECTORIES ➔
                    </button>
                  </div>
                  <div className="recessed-screen p-3 rounded-sm text-[12px] font-mono max-h-36 overflow-y-auto leading-relaxed text-green-500 text-left">
                    {logs.slice(0, 4).map((log) => {
                      let tagColor = 'text-green-400';
                      if (log.type === 'production') tagColor = 'text-yellow-400';
                      if (log.type === 'parameter') tagColor = 'text-status-oxygen';
                      if (log.type === 'milestone') tagColor = 'text-status-energy';
                      if (log.type === 'reset') tagColor = 'text-red-400 animate-pulse';

                      return (
                        <div key={log.id} className="mb-2 border-b border-green-950/20 pb-1.5 last:border-0 last:pb-0">
                          <span className={`${tagColor} font-bold mr-1.5`}>[GEN_{log.generation}]</span>
                          <span className="text-[10px] text-zinc-500 mr-2">[{log.timestamp}]</span>
                          <span className="text-zinc-300">{log.message}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* ======================= PROD SYS TAB ======================== */}
            {activeTab === 'prod_sys' && (
              <div className="flex-1 flex flex-col gap-6">
                <div className="border-b border-outline-industrial pb-2 flex justify-between items-center">
                  <h3 className="font-display text-sm tracking-widest text-[#ece0dd] uppercase font-bold">
                    PROD_SYS // RESOURCE ANALYTICS
                  </h3>
                  <div className="font-mono text-xs text-outline bg-[#201a19] border border-[#5a413b] px-2 py-0.5 rounded-sm">
                    METRIC CHANNELS ACTIVE
                  </div>
                </div>

                <div className="industrial-panel p-4 md:p-6 rounded-sm">
                  <div className="absolute top-2 left-2 screw opacity-40"></div>
                  <div className="absolute top-2 right-2 screw opacity-40"></div>
                  <div className="absolute bottom-2 left-2 screw opacity-40"></div>
                  <div className="absolute bottom-2 right-2 screw opacity-40"></div>

                  <h4 className="font-display text-xs text-primary font-bold tracking-widest uppercase mb-4 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">query_stats</span> TELEMETRY TIMESERIES
                  </h4>
                  
                  {/* Telemetry charts sweeps */}
                  <TelemetryChart history={history} />
                </div>

                {/* Resource Income projections calculators */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                  <div className="bg-surface-container-low border border-[#5a413b] p-4 rounded-sm">
                    <h4 className="font-display text-xs text-primary font-bold tracking-widest uppercase mb-3 border-b border-outline-variant/30 pb-2">
                      REVENUE STATEMENT (NEXT GENERATION)
                    </h4>
                    <div className="flex flex-col gap-2.5 font-mono text-xs">
                      <div className="flex justify-between py-1 border-b border-outline-variant/10">
                        <span className="text-tertiary">M_CREDITS Total Income</span>
                        <span className="font-bold text-[#ffffff]">
                          {Math.max(0, currentState.terraformRating + currentState.resources.megacredits.production)} MC 
                          <span className="text-[10px] text-zinc-500 ml-1.5">(TR {currentState.terraformRating} + PRD {currentState.resources.megacredits.production})</span>
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-outline-variant/10">
                        <span className="text-secondary-fixed">STEEL_ALLOY Production</span>
                        <span className="font-bold text-[#ffffff]">+{currentState.resources.steel.production}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-outline-variant/10">
                        <span className="text-outline">TITANIUM Production</span>
                        <span className="font-bold text-[#ffffff]">+{currentState.resources.titanium.production}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-outline-variant/10">
                        <span className="text-status-plants">BIO_MATTER Production</span>
                        <span className="font-bold text-[#ffffff]">+{currentState.resources.plants.production}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-outline-variant/10">
                        <span className="text-status-energy">PWR_GRID Production</span>
                        <span className="font-bold text-[#ffffff]">+{currentState.resources.energy.production}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-outline-variant/10 text-status-heat">
                        <span>THERMAL (Production + Energy Transfer)</span>
                        <span className="font-bold">
                          +{currentState.resources.heat.production + currentState.resources.energy.inventory}
                          <span className="text-[10px] text-zinc-500 ml-1.5">(PRD {currentState.resources.heat.production} + Leftover PWR {currentState.resources.energy.inventory})</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface-container-low border border-[#5a413b] p-4 rounded-sm flex flex-col justify-between">
                    <div>
                      <h4 className="font-display text-xs text-primary font-bold tracking-widest uppercase mb-3 border-b border-outline-variant/30 pb-2">
                        STRATEGIC INVENTORY OUTLOOK
                      </h4>
                      <p className="text-xs text-on-surface-variant font-mono leading-relaxed mb-4">
                        Assuming zero card expenditures, within 3 generations raw capital reserves will reach <span className="text-[#ffffff] font-bold">{currentState.resources.megacredits.inventory + (Math.max(0, currentState.terraformRating + currentState.resources.megacredits.production) * 3)} MC</span>. At that time, Bio-matter counts will hover at <span className="text-[#ffffff] font-bold">{currentState.resources.plants.inventory + (currentState.resources.plants.production * 3)} units</span>, satisfying conditions to seed <span className="text-green-400 font-bold">{Math.floor((currentState.resources.plants.inventory + (currentState.resources.plants.production * 3)) / 8)} flora nurseries</span>.
                      </p>
                    </div>
                    <div className="bg-zinc-950 p-2 text-[10px] font-mono text-zinc-500 border border-zinc-900 rounded-sm">
                      * Calculation factors remaining Energy of 6 converting to Heat immediately at epoch end.
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ======================= MILESTONES TAB ======================== */}
            {activeTab === 'milestones' && (
              <div className="flex-1 flex flex-col gap-6">
                <div className="border-b border-outline-industrial pb-2 flex justify-between items-center">
                  <h3 className="font-display text-sm tracking-widest text-[#ece0dd] uppercase font-bold">
                    TERRAN PROJECTS // CLAIMED MILESTONES
                  </h3>
                  <span className="text-xs font-mono text-amber-500 bg-amber-950/20 border border-amber-900 px-2 py-0.5">
                    CLAIM COSTS: 8 MC EACH
                  </span>
                </div>

                <div className="industrial-panel p-4 md:p-6 rounded-sm">
                  <div className="absolute top-2 left-2 screw opacity-40"></div>
                  <div className="absolute top-2 right-2 screw opacity-40"></div>
                  <div className="absolute bottom-2 left-2 screw opacity-40"></div>
                  <div className="absolute bottom-2 right-2 screw opacity-40"></div>

                  <p className="text-xs text-on-surface-variant font-mono mb-6 leading-relaxed">
                    By planetary mandate, players can trigger claim slots for milestone achievements. Only 3 total milestones can be claimed worldwide in a single match. Claiming takes 8 Megacredits immediately. Check or uncheck blocks to match the board game.
                  </p>

                  <div className="flex flex-col gap-4">
                    
                    {/* Terraformer */}
                    <div 
                      onClick={() => toggleMilestone('terraformer')}
                      className={`border-2 p-4 cursor-pointer select-none rounded flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all ${
                        currentState.milestones.terraformer 
                          ? 'border-green-500 bg-green-950/15' 
                          : 'border-outline-industrial bg-[#201a19] hover:border-outline-variant'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center.5 ${
                          currentState.milestones.terraformer ? 'border-green-500 text-green-400' : 'border-zinc-500 text-zinc-500'
                        }`}>
                          <span className="material-symbols-outlined text-sm">globe_uk</span>
                        </div>
                        <div>
                          <h4 className="font-display font-bold text-xs tracking-wider text-primary">TERRAFORMER</h4>
                          <p className="text-[10px] text-on-surface-variant font-mono mt-0.5">Requirements: Have a Terraform Rating (TR) of at least 35.</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 font-mono text-[10px] uppercase font-bold border rounded-sm ${
                        currentState.milestones.terraformer 
                          ? 'bg-green-950/40 text-green-400 border-green-500' 
                          : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                      }`}>
                        {currentState.milestones.terraformer ? 'CLAIMED ✓' : 'LOCKED (8 MC)'}
                      </span>
                    </div>

                    {/* Mayor */}
                    <div 
                      onClick={() => toggleMilestone('mayor')}
                      className={`border-2 p-4 cursor-pointer select-none rounded flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all ${
                        currentState.milestones.mayor 
                          ? 'border-green-500 bg-green-950/15' 
                          : 'border-outline-industrial bg-[#201a19] hover:border-outline-variant'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center.5 ${
                          currentState.milestones.mayor ? 'border-green-500 text-green-400' : 'border-zinc-500 text-zinc-500'
                        }`}>
                          <span className="material-symbols-outlined text-sm">location_city</span>
                        </div>
                        <div>
                          <h4 className="font-display font-bold text-xs tracking-wider text-primary">MAYOR</h4>
                          <p className="text-[10px] text-on-surface-variant font-mono mt-0.5">Requirements: Establish or own at least 3 urban structural city zones.</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 font-mono text-[10px] uppercase font-bold border rounded-sm ${
                        currentState.milestones.mayor 
                          ? 'bg-green-950/40 text-green-400 border-green-500' 
                          : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                      }`}>
                        {currentState.milestones.mayor ? 'CLAIMED ✓' : 'LOCKED (8 MC)'}
                      </span>
                    </div>

                    {/* Gardener */}
                    <div 
                      onClick={() => toggleMilestone('gardener')}
                      className={`border-2 p-4 cursor-pointer select-none rounded flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all ${
                        currentState.milestones.gardener 
                          ? 'border-green-500 bg-green-950/15' 
                          : 'border-outline-industrial bg-[#201a19] hover:border-outline-variant'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center.5 ${
                          currentState.milestones.gardener ? 'border-green-500 text-green-400' : 'border-zinc-500 text-zinc-500'
                        }`}>
                          <span className="material-symbols-outlined text-sm">forest</span>
                        </div>
                        <div>
                          <h4 className="font-display font-bold text-xs tracking-wider text-primary">GARDENER</h4>
                          <p className="text-[10px] text-on-surface-variant font-mono mt-0.5">Requirements: Own or plant at least 3 greenery flora tiles across the map.</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 font-mono text-[10px] uppercase font-bold border rounded-sm ${
                        currentState.milestones.gardener 
                          ? 'bg-green-950/40 text-green-400 border-green-500' 
                          : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                      }`}>
                        {currentState.milestones.gardener ? 'CLAIMED ✓' : 'LOCKED (8 MC)'}
                      </span>
                    </div>

                    {/* Builder */}
                    <div 
                      onClick={() => toggleMilestone('builder')}
                      className={`border-2 p-4 cursor-pointer select-none rounded flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all ${
                        currentState.milestones.builder 
                          ? 'border-green-500 bg-green-950/15' 
                          : 'border-outline-industrial bg-[#201a19] hover:border-outline-variant'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center.5 ${
                          currentState.milestones.builder ? 'border-green-500 text-green-400' : 'border-zinc-500 text-zinc-500'
                        }`}>
                          <span className="material-symbols-outlined text-sm">construction</span>
                        </div>
                        <div>
                          <h4 className="font-display font-bold text-xs tracking-wider text-primary">BUILDER</h4>
                          <p className="text-[10px] text-on-surface-variant font-mono mt-0.5">Requirements: Own at least 8 structural building tags in your registry.</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 font-mono text-[10px] uppercase font-bold border rounded-sm ${
                        currentState.milestones.builder 
                          ? 'bg-green-950/40 text-green-400 border-green-500' 
                          : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                      }`}>
                        {currentState.milestones.builder ? 'CLAIMED ✓' : 'LOCKED (8 MC)'}
                      </span>
                    </div>

                    {/* Planner */}
                    <div 
                      onClick={() => toggleMilestone('planner')}
                      className={`border-2 p-4 cursor-pointer select-none rounded flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all ${
                        currentState.milestones.planner 
                          ? 'border-green-500 bg-green-950/15' 
                          : 'border-outline-industrial bg-[#201a19] hover:border-outline-variant'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center.5 ${
                          currentState.milestones.planner ? 'border-green-500 text-green-400' : 'border-zinc-500 text-zinc-500'
                        }`}>
                          <span className="material-symbols-outlined text-sm">folder_open</span>
                        </div>
                        <div>
                          <h4 className="font-display font-bold text-xs tracking-wider text-primary">PLANNER</h4>
                          <p className="text-[10px] text-on-surface-variant font-mono mt-0.5">Requirements: Maintain a hand size of at least 16 cards simultaneously.</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 font-mono text-[10px] uppercase font-bold border rounded-sm ${
                        currentState.milestones.planner 
                          ? 'bg-green-950/40 text-green-400 border-green-500' 
                          : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                      }`}>
                        {currentState.milestones.planner ? 'CLAIMED ✓' : 'LOCKED (8 MC)'}
                      </span>
                    </div>

                  </div>
                </div>

              </div>
            )}

            {/* ======================= SYS LOGS TAB ======================== */}
            {activeTab === 'sys_log' && (
              <div className="flex-1 flex flex-col gap-6">
                <div className="border-b border-outline-industrial pb-2 flex justify-between items-center">
                  <h3 className="font-display text-sm tracking-widest text-[#ece0dd] uppercase font-bold">
                    SYS_LOG // LOCAL TELEMETRY ARCHIVE
                  </h3>
                  <button
                    onClick={() => {
                      playClickSound(300, 0.1);
                      setLogs(INITIAL_LOGS);
                    }}
                    className="text-[10px] font-mono text-red-400 border border-red-900/60 hover:bg-red-950/20 px-2.5 py-1 uppercase"
                  >
                    Clear Terminal Logs
                  </button>
                </div>

                <div className="industrial-panel p-4 flex-1 flex flex-col rounded-sm relative">
                  <div className="absolute top-2 left-2 screw opacity-40"></div>
                  <div className="absolute top-2 right-2 screw opacity-40"></div>
                  <div className="absolute bottom-2 left-2 screw opacity-40"></div>
                  <div className="absolute bottom-2 right-2 screw opacity-40"></div>

                  <div className="recessed-screen p-4 flex-1 text-green-500 font-mono text-xs overflow-y-auto leading-relaxed max-h-[500px] text-left">
                    {logs.map((log) => {
                      let typeLabel = '[SYS]';
                      let typeColor = 'text-green-400';
                      
                      if (log.type === 'production') {
                        typeLabel = '[PRD]';
                        typeColor = 'text-yellow-400';
                      } else if (log.type === 'adjust') {
                        typeLabel = '[REG]';
                        typeColor = 'text-blue-300';
                      } else if (log.type === 'parameter') {
                        typeLabel = '[ENV]';
                        typeColor = 'text-status-oxygen';
                      } else if (log.type === 'milestone') {
                        typeLabel = '[GOAL]';
                        typeColor = 'text-status-energy';
                      } else if (log.type === 'reset') {
                        typeLabel = '[PURGE]';
                        typeColor = 'text-red-500 animate-pulse';
                      }

                      return (
                        <div key={log.id} className="mb-3 pb-2 border-b border-green-950/15 last:border-0 last:pb-0">
                          <div className="flex justify-between items-center text-[10px] text-zinc-500 mb-1">
                            <span className={`${typeColor} font-bold`}>{typeLabel} GEN {log.generation}</span>
                            <span>{log.timestamp}</span>
                          </div>
                          <span className="text-zinc-300 text-[11px]">{log.message}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* ======================= GUIDE MANUAL TAB ======================== */}
            {activeTab === 'manual' && (
              <div className="flex-1 flex flex-col gap-6">
                <div className="border-b border-outline-industrial pb-2">
                  <h3 className="font-display text-sm tracking-widest text-[#ece0dd] uppercase font-bold">
                    GUIDE_MANUAL // SECTOR TACTICAL MANUAL
                  </h3>
                </div>

                <div className="bg-surface-container-low border border-[#5a413b] p-6 font-sans text-xs text-zinc-300 leading-relaxed rounded-sm space-y-4 text-left">
                  <h4 className="font-display text-xs text-primary font-bold tracking-widest uppercase mb-1">
                    1. TERMINOR RESOURCING MATRIX
                  </h4>
                  <p>
                    This companion utility tracks production metrics for terraforming missions, closely adhering to the directives set forth in standard scientific manuals (specifically inspired by spatial colonial strategy boards). Each resource possesses a stored status count (left large register screen) and an active production level (displayed in the top right PRD badge).
                  </p>

                  <h4 className="font-display text-xs text-primary font-bold tracking-widest uppercase mb-1">
                    2. THERMODYNAMIC CYCLES RULES
                  </h4>
                  <p>
                    Initiating production logs the progression of generation metrics. When <strong>INIT_PRODUCTION</strong> is executed:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 font-mono text-[10px]">
                    <li>All residual energy stored in the <strong>PWR_GRID</strong> register immediately gets converted and transferred to the <strong>THERMAL (Heat)</strong> reserve (reflecting thermodynamic decay of machinery friction).</li>
                    <li>The <strong>PWR_GRID</strong> register is then updated to match the active Power Grid production score.</li>
                    <li>Capital income (Megacredits) produced equals the sum of <strong>Terraform Rating (TR) + Megacredit Production</strong>. If this result is negative, it gets defaulted to 0.</li>
                    <li>All other resourcing registers (Steel, Titanium, Plants, Heat) generate stock corresponding directly to their respective PRD rates.</li>
                  </ul>

                  <h4 className="font-display text-xs text-primary font-bold tracking-widest uppercase mb-1">
                    3. ENVIRONMENTAL CONVERSIONS
                  </h4>
                  <p>
                    Once adequate environmental resources are hoarded, molecular conversions can be actuated manually using spatial shortcuts:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 font-sans">
                    <li><strong>8 Bio-matter (Plants) ➔ 1 Greenery</strong>: Cultivates global Oxygen saturation +1%, advancing Terraform Rating (TR) +1.</li>
                    <li><strong>8 Thermal (Heat) ➔ 1 Core temperature step</strong>: Warms the planetary core by +2°C, advancing Terraform Rating (TR) +1.</li>
                  </ul>
                  <p className="mt-4 text-slate-500 italic">
                    Note: Adjustments can be reverted securely using the telemetry Undo and Redo dials in the CMD interface header.
                  </p>
                </div>

              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 4. RESET PURGE MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="industrial-panel p-6 max-w-sm w-full border-4 border-red-800 text-center">
            {/* Screws */}
            <div className="absolute top-2 left-2 screw"></div>
            <div className="absolute top-2 right-2 screw"></div>
            <div className="absolute bottom-2 left-2 screw"></div>
            <div className="absolute bottom-2 right-2 screw"></div>
 
            <div className="hazard-stripes h-3 w-full mb-4 opacity-75"></div>
            
            <div className="flex items-center justify-center gap-2 mb-4 text-red-500">
              <span className="material-symbols-outlined text-4xl animate-pulse">warning</span>
              <h3 className="font-display text-base font-bold tracking-widest uppercase">CRITICAL SYSTEM PURGE</h3>
            </div>
            
            <div className="recessed-screen p-4 mb-6 text-left">
              <p className="text-red-400 font-mono text-[11px] leading-relaxed">
                SYSTEM PURGE PROTOCOL initiated. Actuating this terminal switch will format all environmental telemetry registers, restore global parameters (O2, Temp, Oceans) to default values, and hard-reset the mission generations back to Generation 01. Clear all progress?
              </p>
            </div>
            
            <div className="flex justify-end gap-3 font-mono">
              <button 
                onClick={() => setShowResetModal(false)}
                className="metal-button px-4 py-2 text-xs"
              >
                ABORT
              </button>
              <button
                onClick={handleFullReset}
                className="px-4 py-2 text-xs bg-red-700 hover:bg-red-600 text-white border border-red-950 font-bold transition-all uppercase tracking-widest active:scale-95 duration-100"
              >
                CONFIRM PURGE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. UPLINK / DATA SHARING IMPORT EXPORT MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="industrial-panel p-6 max-w-lg w-full border border-outline-variant">
            {/* Screws */}
            <div className="absolute top-2 left-2 screw"></div>
            <div className="absolute top-2 right-2 screw"></div>
            <div className="absolute bottom-2 left-2 screw"></div>
            <div className="absolute bottom-2 right-2 screw"></div>

            <h3 className="font-display text-sm font-bold text-primary tracking-widest uppercase mb-4 border-b border-outline-variant pb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">sync_alt</span> HIGH-GAIN UPLINK CONSOLE
            </h3>

            <div className="space-y-4">
              <div>
                <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider block mb-1">
                  Export State Payload (Copy to back up)
                </span>
                <textarea
                  readOnly
                  value={JSON.stringify(currentState)}
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  className="w-full h-16 bg-neutral-950 border border-outline-variant p-2 font-mono text-neutral-400 text-[10px] rounded focus:ring-0 focus:outline-none cursor-pointer resize-none"
                  title="Click to select all"
                />
                <span className="text-[9px] font-mono text-zinc-500 block text-right">
                  * Click inside box to select and copy state code.
                </span>
              </div>

              <div>
                <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider block mb-1">
                  Import State Payload (Paste custom backup code)
                </span>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder='Paste your JSON telemetry payload here...'
                  className="w-full h-16 bg-neutral-950 border border-outline-variant p-2 font-mono text-white text-[10px] rounded focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                />
              </div>

              {importError && (
                <div className="text-[10px] font-mono text-red-400 bg-red-950/20 border border-red-900/40 p-2 rounded">
                  ERROR: {importError}
                </div>
              )}

              <div className="flex justify-end gap-3 font-mono">
                <button 
                  onClick={() => {
                    setShowExportModal(false);
                    setImportText('');
                    setImportError('');
                  }}
                  className="metal-button px-4 py-2 text-xs"
                >
                  DISMISS
                </button>
                <button
                  onClick={triggerStateImport}
                  className="px-4 py-2 text-xs bg-primary text-on-primary font-bold hover:brightness-110 active:brightness-95 transition-all uppercase tracking-widest"
                >
                  LOAD PAYLOAD ➔
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
