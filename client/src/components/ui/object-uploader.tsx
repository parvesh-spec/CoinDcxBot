import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Upload, Image as ImageIcon } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ObjectUploaderProps {
  onImageUploaded: (imageUrl: string) => void;
  onImageRemoved: () => void;
  currentImageUrl?: string;
  className?: string;
}

export default function ObjectUploader({
  onImageUploaded,
  onImageRemoved,
  currentImageUrl,
  className = "",
}: ObjectUploaderProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Get upload URL mutation
  const getUploadUrlMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/templates/images/upload-url");
      return response.json();
    },
  });

  // Finalize upload mutation
  const finalizeUploadMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const response = await apiRequest("POST", "/api/templates/images/finalize", {
        imageUrl,
      });
      return response.json();
    },
  });

  // Upload to storage mutation
  const uploadToStorageMutation = useMutation({
    mutationFn: async ({ uploadUrl, file }: { uploadUrl: string; file: File }) => {
      return new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded * 100) / event.total);
            setUploadProgress(progress);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Upload failed"));
        });

        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });
    },
  });

  const isUploading = getUploadUrlMutation.isPending || 
                     uploadToStorageMutation.isPending || 
                     finalizeUploadMutation.isPending;

  const handleFileSelect = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (PNG, JPG, GIF, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadProgress(0);

      // Step 1: Get upload URL
      const { uploadUrl, imageUrl } = await getUploadUrlMutation.mutateAsync();

      // Step 2: Upload file to storage
      await uploadToStorageMutation.mutateAsync({ uploadUrl, file });

      // Step 3: Finalize upload with ACL
      await finalizeUploadMutation.mutateAsync(imageUrl);

      // Success - notify parent component
      onImageUploaded(imageUrl);
      setUploadProgress(0);

      toast({
        title: "Image uploaded successfully",
        description: "Your image has been uploaded and is ready to use",
      });
    } catch (error) {
      console.error("Upload error:", error);
      setUploadProgress(0);
      
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive",
      });
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input value so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemoveImage = () => {
    onImageRemoved();
    toast({
      title: "Image removed",
      description: "The image has been removed from the template",
    });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  if (currentImageUrl) {
    return (
      <Card className={`w-full ${className}`}>
        <CardContent className="p-4">
          <div className="space-y-4">
            <Label className="text-sm font-medium">Current Image</Label>
            
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" data-testid="progress-upload" />
              </div>
            )}
            
            <div className="relative group">
              <img
                src={currentImageUrl}
                alt="Template image"
                className="w-full h-48 object-cover rounded-lg border"
                data-testid="img-template-current"
              />
              {isUploading && (
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                  <div className="text-white text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                    <p className="text-sm">Uploading {uploadProgress}%</p>
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                <Button
                  onClick={handleRemoveImage}
                  variant="destructive"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  data-testid="button-remove-image"
                  disabled={isUploading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </div>
            </div>
            <Button
              onClick={handleUploadClick}
              variant="outline"
              size="sm"
              className="w-full"
              data-testid="button-replace-image"
              disabled={isUploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? "Uploading..." : "Replace Image"}
            </Button>
            
            {/* Hidden file input - always present */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
              data-testid="input-file"
              disabled={isUploading}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`w-full ${className}`}>
      <CardContent className="p-4">
        <div className="space-y-4">
          <Label className="text-sm font-medium">Upload Image</Label>
          
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" data-testid="progress-upload" />
            </div>
          )}
          
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 ${
              isDragging 
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
            } ${isUploading ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleUploadClick}
            data-testid="dropzone-upload"
          >
            <ImageIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-sm font-medium mb-1">
              {isDragging ? "Drop your image here" : "Click to upload or drag and drop"}
            </p>
            <p className="text-xs text-gray-500">
              PNG, JPG, GIF up to 5MB
            </p>
          </div>
          
          {/* Hidden file input - always present */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
            data-testid="input-file"
            disabled={isUploading}
          />
        </div>
      </CardContent>
    </Card>
  );
}