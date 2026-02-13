// Scenario management utilities
function loadScenario(name) {
  try {
    const data = JSON.parse(localStorage.getItem(`fayePortfolioScenario_${name}`));
    return data || null;
  } catch {
    return null;
  }
}

function saveScenario(name, state) {
  localStorage.setItem(`fayePortfolioScenario_${name}` , JSON.stringify(state));
}

function getSavedScenarioNames() {
  return Object.keys(localStorage)
    .filter(key => key.startsWith('fayePortfolioScenario_'))
    .map(key => key.replace('fayePortfolioScenario_', ''));
}

function loadLastScenarioName() {
  return localStorage.getItem('fayePortfolioLastScenarioName') || null;
}

function saveLastScenarioName(name) {
  localStorage.setItem('fayePortfolioLastScenarioName', name);
}

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Calendar, BarChart3, Users, Settings, Download, Upload, RotateCcw, Database, Save, ChevronLeft, ChevronRight, File, Trash2, Pencil, HelpCircle, Plus, LogOut, Share2 } from 'lucide-react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { PortfolioProvider, usePortfolio } from '@/contexts/PortfolioContext'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import DashboardPage from '@/pages/DashboardPage'
import PortfolioSelector from '@/components/PortfolioSelector'
import ShareManager from '@/components/ShareManager'
import fayeLogo from './assets/faye-logo-white.png'
import ValueStreamSidebar from './components/ValueStreamSidebar.jsx'
import GanttChart from './components/GanttChart.jsx'
import ProjectForm from './components/ProjectForm.jsx'
import ResourcePlanningPanel from './components/ResourcePlanningPanel.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import FilesPage from './pages/FilesPage.jsx'
import RocksPlanning from './components/RocksPlanning.jsx'
import ScenarioManager from './components/ScenarioManager.jsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import './App.css'
import { projects as initialProjects, valueStreams as initialValueStreams, resourceTypes as initialResourceTypes } from './data/sampleData.js';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu.jsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { calculateResourceRequirementsForRange } from './utils/resourceCalculator';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import HelpPage from '@/components/HelpPage';
import ResourceChart from './components/ResourceChart.jsx';

function parseAsanaTasks(asanaJson, valueStreamId) {
  if (!asanaJson || !Array.isArray(asanaJson.data)) {
    throw new Error("Invalid Asana JSON: missing 'data' array.");
  }

  // Helper to extract custom field value
  const getCustomField = (task, name) => {
    if (!Array.isArray(task.custom_fields)) return null;
    const field = task.custom_fields.find(f => f.name === name);
    if (!field) return null;
    
    if (field.type === 'date') {
      return field.date_value?.date || field.display_value?.split('T')[0] || null;
    }
    if (field.type === 'enum') {
      return field.enum_value?.name || field.display_value || null;
    }
    return field.display_value || null;
  };

  // First, find all milestone tasks
  const milestoneTasks = asanaJson.data.filter(task => 
    task.resource_subtype === 'milestone'
  );

  // Create a map of milestone tasks for quick lookup
  const milestoneMap = new Map(milestoneTasks.map(task => [task.gid, task]));

  // Then process all tasks, creating projects and adding milestones
  const importedProjects = asanaJson.data
    .filter(task => task.resource_subtype !== 'milestone')
    .map(task => {
      // Fallbacks for start/end dates
      const startDate = task.start_on || getCustomField(task, 'Start Date') || null;
      const endDate = task.due_on || null;

      // Map status with fallbacks
      let status = 'planned';
      if (task.completed) {
        status = 'completed';
      } else {
        const jiraStatus = getCustomField(task, 'Jira status');
        if (jiraStatus) {
          status = jiraStatus.toLowerCase();
        }
      }

      // Map priority with fallbacks
      let priority = 'medium';
      const jiraPriority = getCustomField(task, 'Jira priority');
      if (jiraPriority) {
        priority = jiraPriority.toLowerCase();
      }

      // Create the base project object
      const project = {
        id: `asana-${task.gid}`,
        name: task.name || 'Untitled',
        description: task.notes || '',
        valueStreamId,
        startDate,
        endDate,
        status,
        priority,
        progress: 0,
        resources: {},
        milestones: [],
        asanaUrl: task.permalink_url || '',
        dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
      };

      // Find any milestone tasks that are subtasks of this task
      const subtaskMilestones = asanaJson.data.filter(subtask => 
        subtask.resource_subtype === 'milestone' && 
        subtask.parent?.gid === task.gid
      );

      // Add milestones to the project
      subtaskMilestones.forEach(milestoneTask => {
        const milestoneDate = milestoneTask.due_on || 
                            getCustomField(milestoneTask, 'Start Date') || 
                            milestoneTask.start_on;
        
        project.milestones.push({
          id: `milestone-${milestoneTask.gid}`,
          name: milestoneTask.name || 'Untitled Milestone',
          date: milestoneDate,
          description: milestoneTask.notes || '',
          status: milestoneTask.completed ? 'completed' : 'planned',
          asanaUrl: milestoneTask.permalink_url || '',
        });
      });

      return project;
    });

  return importedProjects;
}

function PortfolioView() {
  const { isAuthenticated } = useAuth();
  const portfolio = usePortfolio();
  const { currentPortfolio, savePortfolioData, accessRole } = portfolio;

  // Load last scenario only once on mount
  const initialLoadRef = useRef(false);
  const lastScenarioName = loadLastScenarioName();
  const lastScenario = lastScenarioName ? loadScenario(lastScenarioName) : null;

  // When authenticated, init state from portfolio data; else from localStorage
  const initData = currentPortfolio?.data;

  // Scenario state
  const [scenarioName, setScenarioName] = useState(lastScenarioName || 'Default');
  const [projects, setProjects] = useState(initData?.projects ?? lastScenario?.projects ?? initialProjects);
  const [valueStreams, setValueStreams] = useState(initData?.valueStreams ?? lastScenario?.valueStreams ?? initialValueStreams);
  const [resourceTypes, setResourceTypes] = useState(initData?.resourceTypes ?? lastScenario?.resourceTypes ?? initialResourceTypes);
  const [selectedValueStream, setSelectedValueStream] = useState(null)
  const [currentView, setCurrentView] = useState('portfolio')
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false)
  const [selectedValueStreamForForm, setSelectedValueStreamForForm] = useState(null)
  const [editingProject, setEditingProject] = useState(null)
  const [sidebarWidth, setSidebarWidth] = useState(320) // Default width
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef(null)
  const [newScenarioName, setNewScenarioName] = useState('');
  const [showAsanaImport, setShowAsanaImport] = useState(false);
  const [asanaImportValueStream, setAsanaImportValueStream] = useState(valueStreams[0]?.id || '');
  const [contractHours, setContractHours] = useState(() => {
    if (initData?.contractHours !== undefined) return initData.contractHours;
    const saved = localStorage.getItem('contractHours');
    return saved ? parseInt(saved, 10) : 0;
  });
  const ganttChartRef = useRef();
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRange, setSelectedRange] = useState('currentQuarter');
  const [clientName, setClientName] = useState(() => {
    if (currentPortfolio) return currentPortfolio.clientName || 'No Client Name';
    const savedData = localStorage.getItem('portfolioData');
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        return data.clientName || 'No Client Name';
      } catch {
        return 'No Client Name';
      }
    }
    return 'No Client Name';
  });
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [showFilesModal, setShowFilesModal] = useState(false);

  // Sync state when portfolio changes (server-backed portfolios)
  const portfolioIdRef = useRef(currentPortfolio?.id);
  useEffect(() => {
    if (currentPortfolio && currentPortfolio.id !== portfolioIdRef.current) {
      portfolioIdRef.current = currentPortfolio.id;
      const d = currentPortfolio.data || {};
      setProjects(d.projects || []);
      setValueStreams(d.valueStreams || []);
      setResourceTypes(d.resourceTypes || []);
      setContractHours(d.contractHours || 0);
      setClientName(currentPortfolio.clientName || 'No Client Name');
    }
  }, [currentPortfolio]);

  // Auto-save to API when data changes (debounced)
  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (!isAuthenticated || !currentPortfolio) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      savePortfolioData({ projects, valueStreams, resourceTypes, contractHours });
    }, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [projects, valueStreams, resourceTypes, contractHours, isAuthenticated, currentPortfolio, savePortfolioData]);

  // Helper function to save data
  const saveData = (dataToSave = null) => {
    try {
      const data = dataToSave || {
        projects,
        valueStreams,
        resourceTypes,
        clientName,
      };
      
      // Try localStorage first
      try {
        localStorage.setItem('portfolioData', JSON.stringify(data));
        console.log('Data saved successfully to localStorage');
        return true;
      } catch (localError) {
        console.warn('localStorage failed, trying sessionStorage:', localError);
        
        // Fallback to sessionStorage
        try {
          sessionStorage.setItem('portfolioData', JSON.stringify(data));
          console.log('Data saved successfully to sessionStorage');
          return true;
        } catch (sessionError) {
          console.error('Both storage methods failed:', sessionError);
          return false;
        }
      }
    } catch (error) {
      console.error('Error saving data:', error);
      return false;
    }
  };

  // Helper function to load data
  const loadData = () => {
    try {
      console.log('Attempting to load from localStorage...');
      const savedData = localStorage.getItem('portfolioData');
      if (savedData) {
        console.log('Data found in localStorage');
        return JSON.parse(savedData);
      }
      
      console.log('Attempting to load from sessionStorage...');
      const sessionData = sessionStorage.getItem('portfolioData');
      if (sessionData) {
        console.log('Data found in sessionStorage');
        return JSON.parse(sessionData);
      }
      
      console.log('No data found in either storage');
      return null;
    } catch (error) {
      console.error('Error loading data:', error);
      return null;
    }
  };

  // On first mount, load from localStorage only when NOT using a server-backed portfolio
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isAuthenticated && currentPortfolio) return; // Server data already loaded via initData

    try {
      const data = loadData();
      if (data) {
        setProjects(data.projects ?? []);
        setValueStreams(data.valueStreams ?? []);
        setResourceTypes(data.resourceTypes ?? []);
      } else {
        setProjects(initialProjects);
        setValueStreams(initialValueStreams);
        setResourceTypes(initialResourceTypes);
      }
    } catch {
      setProjects(initialProjects);
      setValueStreams(initialValueStreams);
      setResourceTypes(initialResourceTypes);
    }
  }, []);

  // Save scenario on change — only when not using server-backed portfolio
  useEffect(() => {
    if (isAuthenticated && currentPortfolio) return;
    saveScenario(scenarioName, { projects, valueStreams, resourceTypes });
    saveLastScenarioName(scenarioName);
  }, [projects, valueStreams, resourceTypes, scenarioName, isAuthenticated, currentPortfolio]);

  // Save contract hours when changed — only when not using server-backed portfolio
  useEffect(() => {
    if (isAuthenticated && currentPortfolio) return;
    localStorage.setItem('contractHours', contractHours.toString());
  }, [contractHours, isAuthenticated, currentPortfolio]);

  // Handle sidebar resize
  const handleMouseDown = (e) => {
    e.preventDefault()
    setIsResizing(true)
  }

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return
      
      const newWidth = e.clientX
      if (newWidth >= 200 && newWidth <= 500) { // Min and max width constraints
        setSidebarWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  const handleValueStreamSelect = (valueStreamId) => {
    setSelectedValueStream(selectedValueStream === valueStreamId ? null : valueStreamId)
  }

  const handleAddProject = (valueStreamId = null, projectToEdit = null) => {
    setSelectedValueStreamForForm(valueStreamId)
    setIsProjectFormOpen(true)
    if (projectToEdit) {
      setEditingProject(projectToEdit)
    }
  }

  const handleSaveProject = (newProject) => {
    if (editingProject) {
      setProjects(prev => prev.map(p => p.id === newProject.id ? newProject : p))
      setEditingProject(null)
    } else {
      setProjects(prev => [...prev, newProject])
    }
  }

  const handleUpdateProject = (updatedProject) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p))
  }

  const handleCloseProjectForm = () => {
    setIsProjectFormOpen(false)
    setSelectedValueStreamForForm(null)
    setEditingProject(null)
  }

  const handleUpdateValueStreams = (newValueStreams) => {
    setValueStreams(newValueStreams)
  }

  const handleUpdateResourceTypes = (newResourceTypes) => {
    setResourceTypes(newResourceTypes)
  }

  // Export/Import functionality
  const exportData = () => {
    const exportData = {
      projects,
      valueStreams,
      resourceTypes,
      clientName,
      contractHours,
      rocks: JSON.parse(localStorage.getItem('rocks') || '[]'),
      exportDate: new Date().toISOString(),
      version: '1.0'
    }
    
    const dataStr = JSON.stringify(exportData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `faye-portfolio-${new Date().toISOString().split('T')[0]}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const handleImportData = async (file) => {
    try {
      setIsImporting(true);
      setError(null);
      console.log('Starting import process...');
      
      if (!file) {
        throw new Error('No file selected');
      }
      
      const buffer = await file.arrayBuffer();
      const text = new TextDecoder().decode(buffer);
      console.log('File read successfully:', text.substring(0, 100) + '...');
      
      let data;
      try {
        data = JSON.parse(text);
        console.log('JSON parsed successfully. Keys:', Object.keys(data));
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error('Invalid JSON format. Please ensure the file is properly formatted JSON.');
      }
      
      // Validate data structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data: Root must be an object');
      }
      
      // Check for required keys
      const requiredKeys = ['projects', 'valueStreams', 'resourceTypes'];
      const missingKeys = requiredKeys.filter(key => !(key in data));
      if (missingKeys.length > 0) {
        throw new Error(`Missing required keys: ${missingKeys.join(', ')}`);
      }
      
      // Validate each array
      if (!Array.isArray(data.projects)) {
        throw new Error('Projects must be an array');
      }
      if (!Array.isArray(data.valueStreams)) {
        throw new Error('Value Streams must be an array');
      }
      if (!Array.isArray(data.resourceTypes)) {
        throw new Error('Resource Types must be an array');
      }
      if (data.rocks && !Array.isArray(data.rocks)) {
        throw new Error('Rocks must be an array');
      }
      
      // Clean and normalize the data
      console.log('Cleaning and normalizing data...');
      const cleanData = {
        projects: data.projects.map(project => ({
          ...project,
          id: String(project.id || Math.random().toString(36).substr(2, 9)),
          name: String(project.name || ''),
          valueStreamId: String(project.valueStreamId || ''),
          startDate: String(project.startDate || ''),
          endDate: String(project.endDate || ''),
          status: String(project.status || 'planned'),
          priority: String(project.priority || 'medium'),
          description: String(project.description || ''),
          progress: Number(project.progress || 0),
          resources: Object.entries(project.resources || {}).reduce((acc, [key, value]) => ({
            ...acc,
            [key]: {
              allocated: Number(value.allocated || 0),
              required: Number(value.required || 0)
            }
          }), {}),
          milestones: (project.milestones || []).map(milestone => ({
            ...milestone,
            id: String(milestone.id || Math.random().toString(36).substr(2, 9)),
            name: String(milestone.name || ''),
            date: String(milestone.date || ''),
            status: String(milestone.status || 'planned')
          })),
          asanaUrl: String(project.asanaUrl || ''),
          resourceTypeId: project.resourceTypeId ? String(project.resourceTypeId) : null,
          pmAllocation: Number(project.pmAllocation || 20),
          autoPopulatePM: Boolean(project.autoPopulatePM),
          estimatedHours: Number(project.estimatedHours || 0),
          pmHours: Number(project.pmHours || 0),
          totalHours: project.simpleMode ? 
            Number(project.estimatedHours || 0) + Number(project.pmHours || 0) :
            Object.values(project.resources || {})
              .reduce((sum, resource) => sum + (Number(resource.hours) || 0), 0),
          hoursUsed: Number(project.hoursUsed || 0),
          simpleMode: Boolean(project.simpleMode),
          dependencies: Array.isArray(project.dependencies) ? project.dependencies : []
        })),
        valueStreams: data.valueStreams.map(vs => ({
          ...vs,
          id: String(vs.id || Math.random().toString(36).substr(2, 9)),
          name: String(vs.name || ''),
          description: String(vs.description || ''),
          color: String(vs.color || '#3B82F6'),
          primaryStakeholder: String(vs.primaryStakeholder || ''),
          scorecardMetrics: String(vs.scorecardMetrics || '')
        })),
        resourceTypes: data.resourceTypes.map(rt => ({
          ...rt,
          id: String(rt.id || Math.random().toString(36).substr(2, 9)),
          name: String(rt.name || ''),
          hourlyRate: Number(rt.hourlyRate || 0),
          capacity: Number(rt.capacity || 1),
          color: String(rt.color || '#3B82F6')
        })),
        clientName: data.clientName || clientName,
        contractHours: Number(data.contractHours || 0),
        rocks: (data.rocks || []).map(rock => ({
          ...rock,
          id: String(rock.id || Math.random().toString(36).substr(2, 9)),
          valueStreamId: String(rock.valueStreamId || ''),
          quarter: Number(rock.quarter || 1),
          year: Number(rock.year || 2025),
          name: String(rock.name || ''),
          status: String(rock.status || 'not-started')
        }))
      };
      
      console.log('Data cleaned and normalized. Proceeding with state update...');
      
      // Update state with imported data first
      setProjects(cleanData.projects.map(project => ({
        ...project,
        dependencies: Array.isArray(project.dependencies) ? project.dependencies : []
      })));
      setValueStreams(cleanData.valueStreams);
      setResourceTypes(cleanData.resourceTypes);
      setContractHours(cleanData.contractHours);
      localStorage.setItem('rocks', JSON.stringify(cleanData.rocks));
      console.log('State updated with imported data');
      
      // Then try to save to storage
      try {
        localStorage.setItem('portfolioData', JSON.stringify({
          projects: cleanData.projects.map(project => ({
            ...project,
            dependencies: Array.isArray(project.dependencies) ? project.dependencies : []
          })),
          valueStreams: cleanData.valueStreams,
          resourceTypes: cleanData.resourceTypes,
          clientName: cleanData.clientName
        }));
        console.log('Data saved to localStorage');
      } catch (localError) {
        console.warn('localStorage failed, trying sessionStorage:', localError);
        try {
          sessionStorage.setItem('portfolioData', JSON.stringify({
            projects: cleanData.projects.map(project => ({
              ...project,
              dependencies: Array.isArray(project.dependencies) ? project.dependencies : []
            })),
            valueStreams: cleanData.valueStreams,
            resourceTypes: cleanData.resourceTypes,
            clientName: cleanData.clientName
          }));
          console.log('Data saved to sessionStorage');
        } catch (sessionError) {
          console.warn('Both storage methods failed, but data is loaded in memory:', sessionError);
        }
      }
      
      // Show success message
      const message = [
        `Successfully imported:`,
        `- ${cleanData.projects.length} projects`,
        `- ${cleanData.valueStreams.length} value streams`,
        `- ${cleanData.resourceTypes.length} resource types`,
        data.rocks ? `- ${cleanData.rocks.length} rocks` : null,
        data.contractHours ? `- Contract hours: ${cleanData.contractHours}` : null,
        data.clientName ? `- Client name: ${cleanData.clientName}` : null
      ].filter(Boolean).join('\n');
      alert(message);
      
      console.log('Import completed successfully');
    } catch (err) {
      console.error('Import failed:', err);
      setError(err.message);
      alert(`Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const triggerImport = () => {
    document.getElementById('import-file').click()
  }

  const resetData = () => {
    if (confirm('Are you sure you want to reset all data? This will remove all projects, value streams, and resource types. This action cannot be undone.')) {
      setProjects([])
      setValueStreams([])
      setResourceTypes([])
      setSelectedValueStream(null)
      setCurrentView('portfolio')
      alert('All data has been reset. You can now start fresh or load demo data.')
    }
  }

  const loadDemoData = () => {
    if (confirm('Load demo data? This will replace all current data with the sample portfolio data.')) {
      setProjects(initialProjects)
      setValueStreams(initialValueStreams)
      setResourceTypes(initialResourceTypes)
      setSelectedValueStream(null)
      setCurrentView('portfolio')
      alert(`Demo data loaded successfully! Added ${initialProjects.length} sample projects and ${initialValueStreams.length} value streams.`)
    }
  }

  const handleAsanaImportFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      if (!text || text.trim() === '') {
        alert('The selected file is empty. Please select a valid Asana JSON export.');
        return;
      }
      try {
        const asanaData = JSON.parse(text);
        const importedProjects = parseAsanaTasks(asanaData, asanaImportValueStream);
        
        if (importedProjects.length === 0) {
          alert('No valid tasks found in the Asana export.');
          return;
        }

        // Check for duplicates
        const duplicateIds = importedProjects
          .map(p => p.id)
          .filter(id => projects.some(p => p.id === id));

        if (duplicateIds.length > 0) {
          const shouldReplace = window.confirm(
            `Found ${duplicateIds.length} existing tasks with the same IDs. Would you like to replace them? (Click OK to replace, Cancel to skip duplicates)`
          );

          if (shouldReplace) {
            // Replace existing projects and add new ones
            setProjects(prev => {
              const filtered = prev.filter(p => !duplicateIds.includes(p.id));
              return [...filtered, ...importedProjects];
            });
          } else {
            // Skip duplicates and only add new projects
            setProjects(prev => {
              const newProjects = importedProjects.filter(p => !duplicateIds.includes(p.id));
              return [...prev, ...newProjects];
            });
          }
        } else {
          // No duplicates, just add all projects
          setProjects(prev => [...prev, ...importedProjects]);
        }
        
        // Show success message
        alert(`Successfully imported ${importedProjects.length} tasks from Asana!`);
        
        // Close the import modal
        setShowAsanaImport(false);
      } catch (error) {
        console.error('Asana import error:', error);
        alert('Error importing Asana data: The file is not valid JSON. Please check your Asana export.');
      }
    };

    reader.onerror = () => {
      alert('Error reading the Asana export file. Please try again.');
    };

    reader.readAsText(file);
    
    // Reset the input so the same file can be imported again
    event.target.value = '';
  };

  const handleDeleteProject = (projectToDelete) => {
    setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
    setIsProjectFormOpen(false);
    setEditingProject(null);
  };

  const handleReorderProjects = (valueStreamId, newOrder) => {
    setProjects(prev => {
      // Remove all projects for this value stream from prev
      const others = prev.filter(p => p.valueStreamId !== valueStreamId);
      // Add the reordered projects for this value stream
      return [...others, ...newOrder];
    });
  };

  // Calculate average hours per month for visible projects
  let visibleProjects = projects;
  let timelineStart = null;
  let timelineEnd = null;
  if (currentView === 'portfolio') {
    // Try to match GanttChart's logic for timeline
    const now = new Date();
    let startDate, endDate;
    if (ganttChartRef.current && ganttChartRef.current.timelineData) {
      startDate = ganttChartRef.current.timelineData.startDate;
      endDate = ganttChartRef.current.timelineData.endDate;
    } else {
      // Fallback: use current month and timeRange
      const timeRange = 'quarter'; // Default to quarter for now
      if (timeRange === 'quarter') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 3, 0);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 12, 0);
      }
    }
    timelineStart = startDate;
    timelineEnd = endDate;
    visibleProjects = projects.filter(p => {
      const pStart = new Date(p.startDate);
      const pEnd = new Date(p.endDate);
      return pEnd >= timelineStart && pStart <= timelineEnd;
    });
  }
  // Sum all resource hours for visible projects
  let totalHours = 0;
  let minStart = null, maxEnd = null;
  visibleProjects.forEach(p => {
    Object.values(p.resources || {}).forEach(r => {
      if (typeof r.hours === 'number') totalHours += r.hours;
    });
    const pStart = new Date(p.startDate);
    const pEnd = new Date(p.endDate);
    if (!minStart || pStart < minStart) minStart = pStart;
    if (!maxEnd || pEnd > maxEnd) maxEnd = pEnd;
  });
  // Calculate number of months in visible range
  let months = 1;
  if (minStart && maxEnd) {
    months = (maxEnd.getFullYear() - minStart.getFullYear()) * 12 + (maxEnd.getMonth() - minStart.getMonth()) + 1;
  }
  const avgHoursPerMonth = months > 0 ? Math.round(totalHours / months) : 0;

  // Export to PDF handler
  const handleExportPDF = async () => {
    if (!ganttChartRef.current) return;
    const chartNode = ganttChartRef.current;
    const canvas = await html2canvas(chartNode, { 
      backgroundColor: '#fff', 
      scale: 2,
      onclone: (clonedDoc) => {
        const clonedNode = clonedDoc.querySelector('.gantt-export');
        if (clonedNode) {
          clonedNode.style.backgroundColor = '#fff';
          // Force expanded state for all value streams
          const valueStreams = clonedDoc.querySelectorAll('[data-value-stream]');
          valueStreams.forEach(stream => {
            stream.style.height = 'auto';
            stream.style.opacity = '1';
          });
        }
      }
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save('gantt-chart.pdf');
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    console.log('File selected:', file ? {
      name: file.name,
      size: file.size,
      type: file.type
    } : 'No file');
    
    if (file) {
      console.log('Starting file import...');
      handleImportData(file);
    }
  };

  const resourceData = calculateResourceRequirementsForRange(projects, selectedRange);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-[#59168B] text-white p-4">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img
                src={fayeLogo}
                alt="Faye Logo"
                className="h-8 cursor-pointer"
                onClick={() => { if (isAuthenticated) portfolio.exitPortfolio(); }}
                title="Back to Dashboard"
              />
              {isAuthenticated && <PortfolioSelector />}
              <div className="flex flex-col">
                <span className="text-sm text-purple-200">Portfolio Planner, prepared for</span>
                <div className="flex items-center space-x-2">
                  {isEditingClient ? (
                    <div className="flex items-center space-x-2">
                      <Input
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="h-8 w-64 bg-purple-800 text-white border-purple-700"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setIsEditingClient(false);
                            saveData();
                          }
                        }}
                        onBlur={() => {
                          setIsEditingClient(false);
                          saveData();
                        }}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div 
                      className="flex items-center space-x-2 cursor-pointer hover:text-purple-200"
                      onClick={() => setIsEditingClient(true)}
                    >
                      <h1 className="text-xl font-bold">{clientName}</h1>
                      <Pencil className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Main Navigation Tabs */}
            <nav className="flex items-center space-x-2 bg-white/10 rounded-lg px-2 py-1">
              <Button 
                variant={currentView === 'portfolio' ? 'secondary' : 'ghost'}
                onClick={() => setCurrentView('portfolio')}
                className="text-white hover:text-purple-200"
              >
                <Calendar className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Portfolio</span>
              </Button>
              <Button 
                variant={currentView === 'resource-planning' ? 'secondary' : 'ghost'}
                onClick={() => setCurrentView('resource-planning')}
                className="text-white hover:text-purple-200"
              >
                <Users className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Resources</span>
              </Button>
              <Button 
                variant={currentView === 'rocks-planning' ? 'secondary' : 'ghost'}
                onClick={() => setCurrentView('rocks-planning')}
                className="text-white hover:text-purple-200"
              >
                <BarChart3 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Rocks</span>
              </Button>
              <Button 
                variant={currentView === 'settings' ? 'secondary' : 'ghost'}
                onClick={() => setCurrentView('settings')}
                className="text-white hover:text-purple-200"
              >
                <Settings className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
              <Button 
                variant={currentView === 'files' ? 'secondary' : 'ghost'}
                onClick={() => setShowFilesModal(true)}
                className="text-white hover:text-purple-200"
              >
                <File className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Files</span>
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={currentView === 'help' ? 'secondary' : 'ghost'}
                    onClick={() => setCurrentView('help')}
                    className="text-white"
                  >
                    <HelpCircle className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Help</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View help documentation</p>
                </TooltipContent>
              </Tooltip>
            </nav>
            {/* Import/Export Buttons */}
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                onClick={resetData}
                className="text-white hover:text-red-200"
              >
                <Trash2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="text-white hover:text-purple-200"
                  >
                    <Save className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Scenarios</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Scenario Management</DialogTitle>
                  </DialogHeader>
                  <ScenarioManager
                    currentData={{ projects, valueStreams, resourceTypes }}
                    onLoadScenario={(data) => {
                      setProjects(data.projects);
                      setValueStreams(data.valueStreams);
                      setResourceTypes(data.resourceTypes);
                    }}
                  />
                </DialogContent>
              </Dialog>
              {isAuthenticated && accessRole === 'owner' && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="text-white hover:text-purple-200">
                      <Share2 className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Share</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Share Portfolio</DialogTitle>
                    </DialogHeader>
                    <ShareManager />
                  </DialogContent>
                </Dialog>
              )}
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Sidebar - Value Streams (only show for portfolio view) */}
        {currentView === 'portfolio' && (
          <div 
            className={`relative flex flex-col transition-all duration-200 ease-in-out ${
              isSidebarCollapsed ? 'w-0' : ''
            }`}
            style={{ width: isSidebarCollapsed ? 0 : sidebarWidth }}
            ref={sidebarRef}
          >
            <ValueStreamSidebar 
              projects={projects}
              valueStreams={valueStreams}
              selectedValueStream={selectedValueStream}
              onValueStreamSelect={handleValueStreamSelect}
            />
            
            {/* Resize handle */}
            <div
              className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-purple-500 ${
                isResizing ? 'bg-purple-500' : 'bg-gray-200'
              }`}
              onMouseDown={handleMouseDown}
            />
            
            {/* Toggle button */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="absolute -right-4 top-4 bg-white rounded-full p-1 shadow-md hover:bg-gray-50 z-10"
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="h-4 w-4 text-gray-600" />
              ) : (
                <ChevronLeft className="h-4 w-4 text-gray-600" />
              )}
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className={`flex-1 p-6 ${currentView === 'portfolio' ? '' : 'max-w-full'}`}>
          {currentView === 'portfolio' && (
            <div className="h-full">
              {/* Resource requirements chart above the timeline */}
              <div className="mb-6">
                <ResourceChart projects={projects} resourceTypes={resourceTypes} />
              </div>
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-4 bg-gray-50 p-3 rounded-lg border">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Monthly Contract Limit:</span>
                        <input
                          type="number"
                          value={contractHours}
                          onChange={(e) => setContractHours(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-24 px-2 py-1 border rounded text-right font-mono"
                          min="0"
                        />
                        <span className="text-sm text-gray-500">hours</span>
                      </div>
                      <div className="h-6 w-px bg-gray-300"></div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Required Hours:</span>
                        <span>{resourceData.avgHoursPerMonth} hours/month</span>
                        <select
                          value={selectedRange}
                          onChange={(e) => setSelectedRange(e.target.value)}
                          className="border rounded p-1"
                        >
                          <option value="lastYear">Last Year</option>
                          <option value="lastQuarter">Last Quarter</option>
                          <option value="lastMonth">Last Month</option>
                          <option value="currentMonth">Current Month</option>
                          <option value="currentQuarter">Current Quarter</option>
                          <option value="currentYear">Current Year</option>
                          <option value="nextMonth">Next Month</option>
                          <option value="nextQuarter">Next Quarter</option>
                          <option value="nextYear">Next Year</option>
                        </select>
                      </div>
                      {contractHours > 0 && (
                        <>
                          <div className="h-6 w-px bg-gray-300"></div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">Status:</span>
                            <Badge variant="outline" className={
                              resourceData.avgHoursPerMonth > contractHours ? 'bg-red-50 text-red-700 border-red-200' 
                                : 'bg-green-50 text-green-700 border-green-200'
                            }>
                              {resourceData.avgHoursPerMonth > contractHours 
                                ? `Over by ${(resourceData.avgHoursPerMonth - contractHours).toLocaleString()} hours`
                                : `Under by ${(contractHours - resourceData.avgHoursPerMonth).toLocaleString()} hours`
                              }
                            </Badge>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        {projects.filter(p => p.status === 'in-progress').length} Active
                      </Badge>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        {projects.filter(p => p.status === 'planned').length} Planned
                      </Badge>
                      <Badge variant="outline" className="bg-gray-50 text-gray-700">
                        {projects.length} Total
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              
              <GanttChart 
                projects={projects}
                valueStreams={valueStreams}
                selectedValueStream={selectedValueStream}
                onAddProject={handleAddProject}
                onUpdateProject={handleUpdateProject}
                onDeleteProject={handleDeleteProject}
                onReorderProjects={handleReorderProjects}
                avgHoursPerMonth={resourceData.avgHoursPerMonth}
                chartRef={ganttChartRef}
              />
            </div>
          )}

          {currentView === 'resource-planning' && (
            <ResourcePlanningPanel
              projects={projects}
              resourceTypes={resourceTypes}
              onProjectUpdate={handleUpdateProject}
            />
          )}

          {currentView === 'rocks-planning' && (
            <RocksPlanning
              valueStreams={valueStreams}
              projects={projects}
              resourceTypes={resourceTypes}
              onUpdateProjects={setProjects}
            />
          )}

          {currentView === 'settings' && (
            <SettingsPanel
              valueStreams={valueStreams}
              resourceTypes={resourceTypes}
              onUpdateValueStreams={handleUpdateValueStreams}
              onUpdateResourceTypes={handleUpdateResourceTypes}
            />
          )}

          {currentView === 'help' && (
            <div className="p-6">
              <HelpPage />
            </div>
          )}
        </div>
      </div>

      {/* Files Modal */}
      <Dialog open={showFilesModal} onOpenChange={setShowFilesModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>File Management</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Import Data</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Import from Asana</h3>
                    <Button
                      variant="outline"
                      onClick={() => setShowAsanaImport(true)}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import from Asana
                    </Button>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium mb-2">Import JSON File</h3>
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('fileInput').click()}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import JSON
                    </Button>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileChange}
                      id="fileInput"
                      style={{ display: 'none' }}
                    />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Export Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <div>
                    <h3 className="text-sm font-medium mb-2">Export to JSON</h3>
                    <Button
                      variant="outline"
                      onClick={exportData}
                      className="w-full"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export JSON
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <h3 className="text-sm font-medium mb-2">Reset All Data</h3>
                  <p className="text-sm text-gray-500 mb-4">This will permanently delete all your data. This action cannot be undone.</p>
                  <Button
                    variant="outline"
                    onClick={resetData}
                    className="w-full text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Reset All Data
                  </Button>
                </div>
              </CardContent>
            </Card>
            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-lg">
                {error}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Project Form Modal */}
      <ProjectForm
        isOpen={isProjectFormOpen}
        onClose={handleCloseProjectForm}
        onSave={handleSaveProject}
        valueStreamId={selectedValueStreamForForm}
        resourceTypes={resourceTypes}
        valueStreams={valueStreams}
        editingProject={editingProject}
        onDelete={handleDeleteProject}
        projects={projects}
      />
      
      {/* Hidden file input for import */}
      <input
        id="import-file"
        ref={null}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {showAsanaImport && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 min-w-[320px]">
            <h2 className="text-lg font-bold mb-2">Import from Asana</h2>
            <label className="block mb-2 text-sm font-medium">Select Value Stream:</label>
            <select
              className="w-full mb-4 p-2 border rounded"
              value={asanaImportValueStream}
              onChange={e => setAsanaImportValueStream(e.target.value)}
            >
              {valueStreams.map(vs => (
                <option key={vs.id} value={vs.id}>{vs.name}</option>
              ))}
            </select>
            <label className="block mb-2 text-sm font-medium">Select Asana JSON file:</label>
            <input type="file" accept=".json" onChange={handleAsanaImportFile} className="mb-4" />
            <div className="flex justify-end space-x-2">
              <button onClick={() => setShowAsanaImport(false)} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LogoutButton() {
  const { isAuthenticated, logout, user } = useAuth();
  if (!isAuthenticated) return null;

  return (
    <Button
      variant="ghost"
      onClick={logout}
      className="text-white hover:text-purple-200"
      title={user?.email}
    >
      <LogOut className="h-4 w-4 sm:mr-2" />
      <span className="hidden sm:inline">Logout</span>
    </Button>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AuthenticatedApp() {
  const { currentPortfolio } = usePortfolio();

  if (!currentPortfolio) {
    return <DashboardPage />;
  }

  return <PortfolioView />;
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <PortfolioProvider>
                <AuthenticatedApp />
              </PortfolioProvider>
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

