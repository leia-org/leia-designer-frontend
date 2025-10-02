import type React from "react";
import { Header } from "../components/shared/Header";
import { useEffect, useState, useCallback } from "react";
import type { Experiment } from "../models/Experiment";
import type { Leia } from "../models/Leia";
import api from "../lib/axios";
import { ToastContainer, toast } from "react-toastify";
import { LeiaViewModal } from "../components/LeiaViewModal";
import {
  ExclamationCircleIcon,
  ArrowPathIcon,
  BriefcaseIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";

export const MyActivities: React.FC = () => {
  const [experiments, setExperiments] = useState<Experiment[] | null>(null);
  const [loadingExperiments, setLoadingExperiments] = useState(false);
  const [errorLoadingExperiments, setErrorLoadingExperiments] = useState("");
  const [creatingNewExperiment, setCreatingNewExperiment] = useState(false);
  const [newExperimentName, setNewExperimentName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // LEIA accordion and viewing state
  const [expandedExperiments, setExpandedExperiments] = useState<Set<string>>(
    new Set()
  );
  const [selectedLeia, setSelectedLeia] = useState<Leia | null>(null);
  const [showLeiaModal, setShowLeiaModal] = useState(false);
  const [preloadModal, setPreloadModal] = useState(false);

  // Publishing state
  const [publishingExperiments, setPublishingExperiments] = useState<
    Set<string>
  >(new Set());

  // Fetch experiments for the current user

  const fetchExperiments = async () => {
    setLoadingExperiments(true);
    setErrorLoadingExperiments("");
    try {
      const response = await api.get("/api/v1/experiments/user/me", {
        params: { populated: true },
      });
      setExperiments(response.data);
    } catch (error) {
      if (error instanceof Error) {
        setErrorLoadingExperiments(
          "Error loading activities: " + error.message
        );
      } else {
        setErrorLoadingExperiments("Error loading activities");
      }
    } finally {
      setLoadingExperiments(false);
    }
  };

  useEffect(() => {
    fetchExperiments();
  }, []);

  const handleCreateExperiment = async () => {
    if (!newExperimentName.trim()) return;

    try {
      setCreatingNewExperiment(true);
      const response = await api.post<Experiment>("/api/v1/experiments", {
        name: newExperimentName.trim(),
      });

      setExperiments((prev) => [...(prev || []), response.data]);

      toast.success("Activity '" + response.data.name + "' created", {
        position: "bottom-right",
        autoClose: 5000,
      });

      setNewExperimentName("");
      setShowCreateModal(false);
    } catch (error) {
      if (error instanceof Error) {
        toast.error("Could not create new activity: " + error.message, {
          position: "bottom-right",
          autoClose: 5000,
        });
      }
    } finally {
      setCreatingNewExperiment(false);
    }
  };

  // Get LEIAs for a specific experiment (from already loaded experiment data)

  // Toggle experiment accordion
  const toggleExperiment = useCallback(
    (experimentId: string) => {
      const newExpanded = new Set(expandedExperiments);
      if (newExpanded.has(experimentId)) {
        newExpanded.delete(experimentId);
      } else {
        newExpanded.add(experimentId);
      }
      setExpandedExperiments(newExpanded);
    },
    [expandedExperiments]
  );

  // Open LEIA viewing modal - optimizado para evitar re-renders
  const viewLeiaContent = useCallback((leia: Leia) => {
    setSelectedLeia(leia);
    setShowLeiaModal(true);
  }, []);

  // Publish experiment (one-way action)
  const publishExperiment = async (experiment: Experiment) => {
    setPublishingExperiments((prev) => new Set([...prev, experiment.id]));

    try {
      const response = await api.patch(
        `/api/v1/experiments/${experiment.id}/publish`
      );

      // Update the experiment in the local state
      setExperiments(
        (prev) =>
          prev?.map((exp) =>
            exp.id === experiment.id
              ? { ...exp, isPublished: response.data.isPublished }
              : exp
          ) || null
      );

      toast.success("Activity published successfully", {
        position: "bottom-right",
        autoClose: 3000,
      });
    } catch {
      toast.error("Failed to publish activity", {
        position: "bottom-right",
        autoClose: 3000,
      });
    } finally {
      setPublishingExperiments((prev) => {
        const newSet = new Set([...prev]);
        newSet.delete(experiment.id);
        return newSet;
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      <Header
        title="My Activities"
        description="View and manage your activities"
      />
      <ToastContainer />

      {/* Create Activity Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
              setNewExperimentName("");
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
            <div
              className="p-6"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Create New Activity
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Activity Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter activity name..."
                    value={newExperimentName}
                    onChange={(e) => setNewExperimentName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && newExperimentName.trim()) {
                        handleCreateExperiment();
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                </div>

                {creatingNewExperiment && (
                  <div className="flex items-center justify-center text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Creating activity...
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewExperimentName("");
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateExperiment}
                    disabled={
                      !newExperimentName.trim() || creatingNewExperiment
                    }
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2"
                  >
                    {creatingNewExperiment ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Creating...
                      </>
                    ) : (
                      "Create Activity"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LEIA Content Modal - Mantener montado para mejor rendimiento */}
      {(showLeiaModal || preloadModal) && (
        <LeiaViewModal
          leia={selectedLeia}
          isOpen={showLeiaModal}
          onClose={() => setShowLeiaModal(false)}
        />
      )}

      {/* Activities Header with Search and Create */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search activities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-gray-50 text-gray-500 cursor-not-allowed focus:outline-none"
              />
            </div>

            {/* Create Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <PlusIcon className="h-5 w-5" />
              New Activity
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1">
        {loadingExperiments ? (
          // Loading State - Centered both ways
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading activities...</p>
            </div>
          </div>
        ) : errorLoadingExperiments ? (
          // Error State - Centered both ways
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md px-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="text-red-500 mb-4">
                  <ExclamationCircleIcon className="w-12 h-12 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-red-800 mb-2">
                  Something went wrong
                </h3>
                <p className="text-red-600 text-sm mb-4">
                  {errorLoadingExperiments}
                </p>
                <button
                  onClick={fetchExperiments}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center gap-2 mx-auto"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            </div>
          </div>
        ) : experiments ? (
          // Success State
          <div className="max-w-6xl mx-auto px-6 py-6 w-full">
            <div className="grid gap-4">
              {experiments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <BriefcaseIcon className="w-16 h-16 mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No activities yet
                  </h3>
                  <p className="text-gray-500">
                    Create your first activity to get started
                  </p>
                  <div className="mt-6 flex justify-center">
                    <input
                      type="text"
                      value={newExperimentName}
                      onChange={(e) => setNewExperimentName(e.target.value)}
                      placeholder="Activity Name"
                      className="px-4 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={creatingNewExperiment}
                    />
                    <button
                      onClick={handleCreateExperiment}
                      className={`px-4 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2 ${
                        creatingNewExperiment
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                      disabled={
                        creatingNewExperiment || !newExperimentName.trim()
                      }
                    >
                      {creatingNewExperiment ? (
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      ) : (
                        "Create Activity"
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {experiments.map((experiment) => (
                    <div
                      key={experiment.id}
                      className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow duration-200"
                    >
                      {/* Experiment Header */}
                      <div className="p-6 pb-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                              {experiment.name}
                            </h3>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span>
                                Created:{" "}
                                {new Date(
                                  experiment.createdAt
                                ).toLocaleDateString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <img
                                  src="/logo/leia_puzzle_black.png"
                                  alt="LEIA"
                                  className="w-4 h-4"
                                />
                                {experiment.leias?.length || 0} LEIAs
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${
                                experiment.isPublished
                                  ? "bg-green-100 text-green-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {experiment.isPublished ? "Published" : "Draft"}
                            </span>
                            {!experiment.isPublished && (
                              <button
                                onClick={() => publishExperiment(experiment)}
                                disabled={publishingExperiments.has(
                                  experiment.id
                                )}
                                className="px-3 py-1.5 text-xs font-medium rounded-md border bg-green-50 text-green-700 border-green-200 hover:bg-green-100 disabled:bg-green-25 disabled:text-green-400 disabled:border-green-100 disabled:cursor-not-allowed transition-colors duration-200"
                              >
                                {publishingExperiments.has(experiment.id) ? (
                                  <div className="flex items-center gap-1">
                                    <ArrowPathIcon className="w-3 h-3 animate-spin" />
                                    Publishing...
                                  </div>
                                ) : (
                                  "Publish"
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => toggleExperiment(experiment.id)}
                              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              {expandedExperiments.has(experiment.id) ? (
                                <ChevronUpIcon className="w-5 h-5" />
                              ) : (
                                <ChevronDownIcon className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* LEIAs Accordion */}
                      {expandedExperiments.has(experiment.id) && (
                        <div className="border-t border-gray-200">
                          {experiment.leias && experiment.leias.length > 0 ? (
                            <div className="divide-y divide-gray-100">
                              {experiment.leias.map((leiaConfig, index) => {
                                const leia =
                                  typeof leiaConfig.leia === "object"
                                    ? leiaConfig.leia
                                    : null;
                                return (
                                  <div key={leia?.id || index} className="p-4">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          <h4 className="font-medium text-gray-900">
                                            {leia?.metadata?.name ||
                                              `LEIA ${index + 1}`}
                                          </h4>
                                          {leia && (
                                            <button
                                              onClick={() =>
                                                viewLeiaContent(leia)
                                              }
                                              onMouseEnter={() =>
                                                setPreloadModal(true)
                                              }
                                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                              title="View LEIA content"
                                            >
                                              <EyeIcon className="w-4 h-4" />
                                            </button>
                                          )}
                                        </div>
                                        <div className="space-y-2 text-sm">
                                          {leiaConfig.configuration?.mode && (
                                            <div className="flex items-center gap-2">
                                              <span className="font-medium text-gray-600">
                                                Mode:
                                              </span>
                                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                                {leiaConfig.configuration.mode}
                                              </span>
                                            </div>
                                          )}
                                          {leiaConfig.configuration?.data &&
                                            Object.keys(
                                              leiaConfig.configuration.data
                                            ).length > 0 && (
                                              <div className="flex items-start gap-2">
                                                <span className="font-medium text-gray-600">
                                                  Config:
                                                </span>
                                                <span className="text-gray-700 text-xs bg-gray-50 px-2 py-1 rounded">
                                                  {JSON.stringify(
                                                    leiaConfig.configuration
                                                      .data
                                                  ).substring(0, 100)}
                                                  {JSON.stringify(
                                                    leiaConfig.configuration
                                                      .data
                                                  ).length > 100 && "..."}
                                                </span>
                                              </div>
                                            )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-6 text-center text-gray-500">
                              <img
                                src="/logo/leia_puzzle_black.png"
                                alt="LEIA"
                                className="w-8 h-8 mx-auto opacity-30 mb-2"
                              />
                              <p className="text-sm">
                                No LEIAs in this experiment
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MyActivities;
