import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  Pause, 
  Play, 
  Trash2, 
  RefreshCw,
  Calendar,
  Mail,
  Loader2,
  Edit
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import api, { type ScheduledJob } from "@/services/api";

const ScheduledJobs = () => {
  const { toast } = useToast();
  const [userId, setUserId] = useState(() => localStorage.getItem("tempUserId") || "690c7d0ee107fb31784c1b1b");
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingJob, setEditingJob] = useState<string | null>(null);
  const [editFrequency, setEditFrequency] = useState<"hourly" | "daily" | "weekly">("daily");

  useEffect(() => {
    localStorage.setItem("tempUserId", userId);
  }, [userId]);

  useEffect(() => {
    if (userId && /^[a-f0-9]{24}$/i.test(userId)) {
      fetchScheduledJobs();
    }
  }, [userId]);

  const fetchScheduledJobs = async () => {
    if (!userId || !/^[a-f0-9]{24}$/i.test(userId)) {
      return;
    }

    setIsLoading(true);
    try {
      const { data, response } = await api.getScheduledJobs(userId);

      if (response.ok) {
        setJobs(data.jobs || []);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to fetch scheduled jobs",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Network Error",
        description: "Could not connect to email service",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      const { data, response } = await api.cancelScheduledJob(userId, jobId);

      if (response.ok) {
        toast({
          title: "Success",
          description: "Scheduled job cancelled successfully",
        });
        fetchScheduledJobs();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to cancel job",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Network Error",
        description: "Could not cancel job",
        variant: "destructive",
      });
    }
  };

  const getFrequencyBadge = (frequency: string) => {
    const colors = {
      hourly: "bg-blue-500",
      daily: "bg-green-500",
      weekly: "bg-purple-500"
    };
    return colors[frequency as keyof typeof colors] || "bg-gray-500";
  };

  const formatNextRun = (job: ScheduledJob) => {
    // Calculate next run based on frequency and creation time
    const created = new Date(job.createdAt);
    const now = new Date();
    let nextRun = new Date(created);

    switch (job.frequency) {
      case "hourly":
        nextRun.setHours(nextRun.getHours() + 1);
        while (nextRun < now) {
          nextRun.setHours(nextRun.getHours() + 1);
        }
        break;
      case "daily":
        nextRun.setDate(nextRun.getDate() + 1);
        while (nextRun < now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;
      case "weekly":
        nextRun.setDate(nextRun.getDate() + 7);
        while (nextRun < now) {
          nextRun.setDate(nextRun.getDate() + 7);
        }
        break;
    }

    return nextRun;
  };

  const getTimeUntilNextRun = (nextRun: Date) => {
    const now = new Date();
    const diff = nextRun.getTime() - now.getTime();
    
    if (diff < 0) return "Running soon...";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `in ${days} day${days > 1 ? 's' : ''}`;
    }
    if (hours > 0) {
      return `in ${hours}h ${minutes}m`;
    }
    return `in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Scheduled Jobs</h2>
          <p className="text-muted-foreground">
            Manage your automated email fetch schedules
          </p>
        </div>
        <Button onClick={fetchScheduledJobs} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* User ID Config */}
      <Card className="p-4 animate-in slide-in-from-top duration-300">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label htmlFor="userId">
              User ID <span className="text-xs text-muted-foreground">(Temporary)</span>
            </Label>
            <Input
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="690c7d0ee107fb31784c1b1b"
            />
          </div>
        </div>
      </Card>

      {/* Jobs Table */}
      <Card className="p-6 animate-in slide-in-from-bottom duration-500">
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12 space-y-3 animate-in fade-in duration-700">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No scheduled jobs found</p>
              <p className="text-sm text-muted-foreground">
                Create a scheduled fetch from the Email Sync page
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job, index) => {
                const nextRun = formatNextRun(job);
                const isEditing = editingJob === job.jobId;

                return (
                  <div
                    key={job.jobId}
                    className="border rounded-lg p-4 hover:bg-accent/50 transition-all duration-200 animate-in slide-in-from-right"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      {/* Job Info */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <Badge className={getFrequencyBadge(job.frequency)}>
                            {job.frequency}
                          </Badge>
                          <span className="text-sm font-mono text-muted-foreground">
                            Job ID: {job.jobId.substring(0, 8)}...
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              <span>From Date: {job.filters.fromDate}</span>
                            </div>
                            {job.filters.emails && job.filters.emails.length > 0 && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Mail className="h-4 w-4" />
                                <span>
                                  Vendors: {job.filters.emails.length} email
                                  {job.filters.emails.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-green-600" />
                              <span className="text-green-600 font-medium">
                                Next run: {getTimeUntilNextRun(nextRun)}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {nextRun.toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {job.filters.emails && job.filters.emails.length > 0 && (
                          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                            Filtered emails: {job.filters.emails.join(", ")}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {/* Edit Frequency (Placeholder - would need backend support) */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingJob(isEditing ? null : job.jobId);
                            setEditFrequency(job.frequency);
                          }}
                          className="transition-all duration-200 hover:scale-105"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>

                        {/* Pause/Resume (Placeholder - would need backend support) */}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          title="Coming soon"
                          className="transition-all duration-200"
                        >
                          {job.status === "paused" ? (
                            <Play className="h-4 w-4" />
                          ) : (
                            <Pause className="h-4 w-4" />
                          )}
                        </Button>

                        {/* Delete */}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm("Are you sure you want to cancel this scheduled job?")) {
                              cancelJob(job.jobId);
                            }
                          }}
                          className="transition-all duration-200 hover:scale-105"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Edit Panel */}
                    {isEditing && (
                      <div className="mt-4 pt-4 border-t animate-in slide-in-from-top duration-300">
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <Label>Change Frequency</Label>
                            <select
                              value={editFrequency}
                              onChange={(e) => setEditFrequency(e.target.value as any)}
                              className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2"
                            >
                              <option value="hourly">Hourly</option>
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                            </select>
                          </div>
                          <div className="flex gap-2 pt-6">
                            <Button
                              size="sm"
                              onClick={() => {
                                // Would need backend API to update frequency
                                toast({
                                  title: "Coming Soon",
                                  description: "Edit functionality requires backend API update",
                                });
                              }}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingJob(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Summary Stats */}
      {jobs.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3 animate-in fade-in duration-700">
          <Card className="p-4 transition-all duration-200 hover:shadow-lg">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Jobs</p>
                <p className="text-2xl font-bold">{jobs.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 transition-all duration-200 hover:shadow-lg">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <Play className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">
                  {jobs.filter(j => j.status !== "paused").length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 transition-all duration-200 hover:shadow-lg">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Next Run</p>
                <p className="text-lg font-bold">
                  {jobs.length > 0
                    ? getTimeUntilNextRun(
                        formatNextRun(
                          jobs.sort((a, b) => 
                            formatNextRun(a).getTime() - formatNextRun(b).getTime()
                          )[0]
                        )
                      )
                    : "N/A"}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ScheduledJobs;
