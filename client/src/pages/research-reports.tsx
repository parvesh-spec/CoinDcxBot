import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ResearchReportModal from "@/components/research-reports/research-report-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, Search, Calendar, TrendingUp } from "lucide-react";
import { format } from "date-fns";

// Research Report type based on schema
interface ResearchReport {
  id: string;
  reportId: string;
  pair: string;
  supportLevel: string;
  resistance: string;
  summary: string;
  upsideTarget1: string;
  upsideTarget2: string;
  downsideTarget1: string;
  downsideTarget2: string;
  breakoutPossibility: string;
  breakoutDirection: 'upside' | 'downside';
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export default function ResearchReports() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPair, setFilterPair] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ResearchReport | null>(null);
  const itemsPerPage = 12;

  // Fetch research reports
  const { data: reportsData, isLoading, error, refetch } = useQuery<{reports: ResearchReport[], total: number}>({
    queryKey: ['/api/research-reports'],
  });

  const reports = reportsData?.reports || [];
  const totalReports = reportsData?.total || 0;

  // Filter and search logic
  const filteredReports = reports.filter((report: ResearchReport) => {
    const matchesSearch = !searchTerm || 
      report.pair.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.reportId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPair = filterPair === "all" || report.pair === filterPair;
    
    return matchesSearch && matchesPair;
  });

  // Pagination
  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedReports = filteredReports.slice(startIndex, startIndex + itemsPerPage);

  // Get unique pairs for filter dropdown
  const uniquePairs = Array.from(new Set(reports.map((report: ResearchReport) => report.pair))).sort();


  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <i className="fas fa-exclamation-triangle text-4xl text-red-500" />
              <div>
                <h3 className="text-lg font-semibold">Failed to load reports</h3>
                <p className="text-muted-foreground">Please try again later</p>
              </div>
              <Button onClick={() => refetch()}>
                <i className="fas fa-refresh mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Research Reports</h1>
          <p className="text-muted-foreground">
            Create and manage detailed market analysis reports with price targets
          </p>
        </div>
        <Button 
          onClick={() => {
            setEditingReport(null);
            setIsModalOpen(true);
          }}
          data-testid="button-create-report"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Report
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Search className="w-5 h-5 mr-2" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search Reports</Label>
              <Input
                id="search"
                placeholder="Search by pair, report ID, or summary..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-reports"
              />
            </div>
            <div className="space-y-2">
              <Label>Trading Pair</Label>
              <Select value={filterPair} onValueChange={setFilterPair}>
                <SelectTrigger data-testid="select-pair-filter">
                  <SelectValue placeholder="Select pair..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pairs</SelectItem>
                  {uniquePairs.map((pair) => (
                    <SelectItem key={String(pair)} value={String(pair)}>
                      {String(pair)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quick Actions</Label>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm("");
                  setFilterPair("all");
                  setCurrentPage(1);
                }}
                data-testid="button-clear-filters"
              >
                <i className="fas fa-times mr-2" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Reports</p>
                <p className="text-2xl font-bold">{reports.length}</p>
              </div>
              <FileText className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Unique Pairs</p>
                <p className="text-2xl font-bold">{uniquePairs.length}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Filtered Results</p>
                <p className="text-2xl font-bold">{filteredReports.length}</p>
              </div>
              <Search className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">This Page</p>
                <p className="text-2xl font-bold">{paginatedReports.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Research Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : paginatedReports.length === 0 ? (
            <div className="text-center py-12">
              <div className="space-y-4">
                <FileText className="h-16 w-16 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">No research reports found</h3>
                  <p className="text-muted-foreground">
                    {filteredReports.length === 0 && reports.length > 0 
                      ? "Try adjusting your search filters"
                      : "Create your first research report to get started"
                    }
                  </p>
                </div>
                <Button 
                  onClick={() => {
                    setEditingReport(null);
                    setIsModalOpen(true);
                  }}
                  data-testid="button-create-first-report"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Report
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {paginatedReports.map((report: ResearchReport) => (
                <Card key={report.id} className="relative hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-sm font-medium">
                        {report.pair}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(report.createdAt), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-sm text-muted-foreground">
                        ID: {report.reportId}
                      </h3>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Price Levels */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <p className="font-medium text-muted-foreground">Support</p>
                        <p className="font-semibold text-green-600 dark:text-green-400">
                          ${Number(report.supportLevel).toFixed(4)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-muted-foreground">Resistance</p>
                        <p className="font-semibold text-red-600 dark:text-red-400">
                          ${Number(report.resistance).toFixed(4)}
                        </p>
                      </div>
                    </div>

                    {/* Breakout Direction */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Breakout Direction</span>
                      <span className={`font-semibold px-2 py-1 rounded text-xs ${
                        report.breakoutDirection === 'upside' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                      }`}>
                        {report.breakoutDirection === 'upside' ? '📈 Upside' : '📉 Downside'}
                      </span>
                    </div>

                    {/* Summary */}
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">Analysis Summary</p>
                      <p className="text-sm text-foreground line-clamp-3">
                        {report.summary}
                      </p>
                    </div>

                    {/* Image indicator */}
                    {report.imageUrl && (
                      <div className="flex items-center text-xs text-muted-foreground">
                        <i className="fas fa-image mr-1" />
                        Chart attached
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 text-xs"
                        data-testid={`button-view-report-${report.id}`}
                        onClick={() => {
                          setEditingReport(report);
                          setIsModalOpen(true);
                        }}
                      >
                        <i className="fas fa-eye mr-1" />
                        View
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 text-xs"
                        onClick={() => {
                          setEditingReport(report);
                          setIsModalOpen(true);
                        }}
                        data-testid={`button-edit-report-${report.id}`}
                      >
                        <i className="fas fa-edit mr-1" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredReports.length)} of {filteredReports.length} reports
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  <i className="fas fa-chevron-left mr-1" />
                  Previous
                </Button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        data-testid={`button-page-${pageNum}`}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  Next
                  <i className="fas fa-chevron-right ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Research Report Modal */}
      <ResearchReportModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingReport(null);
        }}
        editReport={editingReport || undefined}
        onSuccess={() => {
          refetch();
        }}
      />
    </div>
  );
}