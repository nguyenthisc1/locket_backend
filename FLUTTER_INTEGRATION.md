# Flutter Integration Guide for Locket Photo Upload

This guide explains how to integrate the Locket backend photo upload API with your Flutter app.

## 📱 **Flutter Setup**

### **1. Required Dependencies**

Add these to your `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  http: ^1.1.0
  image_picker: ^1.0.4
  image: ^4.1.3
  path_provider: ^2.1.1
  permission_handler: ^11.0.1
```

### **2. Environment Variables**

Create a `.env` file in your Flutter project:

```env
API_BASE_URL=http://localhost:8000/api/v1
CLOUDINARY_CLOUD_NAME=your_cloud_name
```

## 🔧 **API Service Class**

### **Photo Upload Service**

```dart
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'package:image/image.dart' as img;

class PhotoUploadService {
  static const String baseUrl = 'http://localhost:8000/api/v1';
  static String? _authToken;

  static void setAuthToken(String token) {
    _authToken = token;
  }

  // Upload single photo with base64
  static Future<Map<String, dynamic>> uploadPhoto({
    required Uint8List imageBytes,
    String? caption,
    List<String>? sharedWith,
    Map<String, double>? location,
  }) async {
    try {
      // Convert image to base64
      String base64Image = base64Encode(imageBytes);
      String imageData = 'data:image/jpeg;base64,$base64Image';

      final response = await http.post(
        Uri.parse('$baseUrl/upload/upload'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_authToken',
        },
        body: jsonEncode({
          'imageData': imageData,
          'caption': caption,
          'sharedWith': sharedWith,
          'location': location,
        }),
      );

      if (response.statusCode == 201) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Upload failed: ${response.body}');
      }
    } catch (e) {
      throw Exception('Upload error: $e');
    }
  }

  // Upload multiple photos
  static Future<Map<String, dynamic>> uploadMultiplePhotos({
    required List<Map<String, dynamic>> photos,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/upload/upload-multiple'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_authToken',
        },
        body: jsonEncode({'photos': photos}),
      );

      if (response.statusCode == 201) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Upload failed: ${response.body}');
      }
    } catch (e) {
      throw Exception('Upload error: $e');
    }
  }

  // Delete photo
  static Future<Map<String, dynamic>> deletePhoto(String photoId) async {
    try {
      final response = await http.delete(
        Uri.parse('$baseUrl/upload/$photoId'),
        headers: {
          'Authorization': 'Bearer $_authToken',
        },
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Delete failed: ${response.body}');
      }
    } catch (e) {
      throw Exception('Delete error: $e');
    }
  }

  // Get optimized image URLs
  static Future<Map<String, dynamic>> getImageUrls(String photoId) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/upload/$photoId/urls'),
        headers: {
          'Authorization': 'Bearer $_authToken',
        },
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to get URLs: ${response.body}');
      }
    } catch (e) {
      throw Exception('Get URLs error: $e');
    }
  }
}
```

## 📸 **Image Picker Implementation**

### **Photo Picker Widget**

```dart
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';

class PhotoPickerWidget extends StatefulWidget {
  @override
  _PhotoPickerWidgetState createState() => _PhotoPickerWidgetState();
}

class _PhotoPickerWidgetState extends State<PhotoPickerWidget> {
  final ImagePicker _picker = ImagePicker();
  bool _isUploading = false;

  Future<void> _pickAndUploadImage(ImageSource source) async {
    try {
      // Request permissions
      if (source == ImageSource.camera) {
        final status = await Permission.camera.request();
        if (!status.isGranted) {
          _showSnackBar('Camera permission required');
          return;
        }
      } else {
        final status = await Permission.photos.request();
        if (!status.isGranted) {
          _showSnackBar('Photo library permission required');
          return;
        }
      }

      // Pick image
      final XFile? image = await _picker.pickImage(
        source: source,
        maxWidth: 1920,
        maxHeight: 1920,
        imageQuality: 85,
      );

      if (image != null) {
        await _uploadImage(image);
      }
    } catch (e) {
      _showSnackBar('Error picking image: $e');
    }
  }

  Future<void> _uploadImage(XFile imageFile) async {
    setState(() {
      _isUploading = true;
    });

    try {
      // Read image bytes
      Uint8List imageBytes = await imageFile.readAsBytes();

      // Compress image if needed
      if (imageBytes.length > 5 * 1024 * 1024) { // 5MB
        imageBytes = await _compressImage(imageBytes);
      }

      // Upload to server
      final result = await PhotoUploadService.uploadPhoto(
        imageBytes: imageBytes,
        caption: 'Uploaded from Flutter app',
      );

      _showSnackBar('Photo uploaded successfully!');
      print('Upload result: $result');
      
    } catch (e) {
      _showSnackBar('Upload failed: $e');
    } finally {
      setState(() {
        _isUploading = false;
      });
    }
  }

  Future<Uint8List> _compressImage(Uint8List imageBytes) async {
    // Decode image
    img.Image? image = img.decodeImage(imageBytes);
    if (image == null) return imageBytes;

    // Resize if too large
    if (image.width > 1920 || image.height > 1920) {
      image = img.copyResize(image, width: 1920, height: 1920);
    }

    // Encode as JPEG with compression
    return Uint8List.fromList(img.encodeJpg(image, quality: 85));
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (_isUploading)
          LinearProgressIndicator()
        else
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              ElevatedButton.icon(
                onPressed: () => _pickAndUploadImage(ImageSource.camera),
                icon: Icon(Icons.camera_alt),
                label: Text('Camera'),
              ),
              ElevatedButton.icon(
                onPressed: () => _pickAndUploadImage(ImageSource.gallery),
                icon: Icon(Icons.photo_library),
                label: Text('Gallery'),
              ),
            ],
          ),
      ],
    );
  }
}
```

## 🖼️ **Image Display Widget**

### **Responsive Image Widget**

```dart
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

class ResponsivePhotoWidget extends StatelessWidget {
  final String imageUrl;
  final String? thumbnailUrl;
  final double? width;
  final double? height;
  final BoxFit fit;

  const ResponsivePhotoWidget({
    Key? key,
    required this.imageUrl,
    this.thumbnailUrl,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return CachedNetworkImage(
      imageUrl: imageUrl,
      width: width,
      height: height,
      fit: fit,
      placeholder: (context, url) => Container(
        color: Colors.grey[300],
        child: Center(
          child: CircularProgressIndicator(),
        ),
      ),
      errorWidget: (context, url, error) => Container(
        color: Colors.grey[300],
        child: Icon(Icons.error),
      ),
      memCacheWidth: width?.toInt(),
      memCacheHeight: height?.toInt(),
    );
  }
}
```

## 📱 **Complete Example Screen**

### **Photo Upload Screen**

```dart
import 'package:flutter/material.dart';

class PhotoUploadScreen extends StatefulWidget {
  @override
  _PhotoUploadScreenState createState() => _PhotoUploadScreenState();
}

class _PhotoUploadScreenState extends State<PhotoUploadScreen> {
  List<Map<String, dynamic>> _uploadedPhotos = [];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Photo Upload'),
      ),
      body: Column(
        children: [
          // Upload buttons
          Padding(
            padding: EdgeInsets.all(16),
            child: PhotoPickerWidget(),
          ),
          
          // Uploaded photos grid
          Expanded(
            child: GridView.builder(
              padding: EdgeInsets.all(16),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
              ),
              itemCount: _uploadedPhotos.length,
              itemBuilder: (context, index) {
                final photo = _uploadedPhotos[index];
                return ResponsivePhotoWidget(
                  imageUrl: photo['cloudinary']['url'],
                  width: 150,
                  height: 150,
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
```

## 🔐 **Authentication Integration**

### **Login and Token Management**

```dart
class AuthService {
  static const String baseUrl = 'http://localhost:8000/api/v1';
  static String? _authToken;

  static Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'password': password,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        _authToken = data['accessToken'];
        
        // Set token for photo upload service
        PhotoUploadService.setAuthToken(_authToken!);
        
        return data;
      } else {
        throw Exception('Login failed: ${response.body}');
      }
    } catch (e) {
      throw Exception('Login error: $e');
    }
  }

  static String? get authToken => _authToken;
}
```

## 🚀 **Usage Examples**

### **1. Single Photo Upload**

```dart
// Pick and upload a single photo
final result = await PhotoUploadService.uploadPhoto(
  imageBytes: imageBytes,
  caption: 'My awesome photo!',
  sharedWith: ['user_id_1', 'user_id_2'],
  location: {
    'lat': 40.7128,
    'lng': -74.0060,
  },
);

print('Uploaded photo ID: ${result['photo']['photo']['id']}');
```

### **2. Multiple Photos Upload**

```dart
// Upload multiple photos
List<Map<String, dynamic>> photos = [
  {
    'imageData': base64Image1,
    'caption': 'First photo',
  },
  {
    'imageData': base64Image2,
    'caption': 'Second photo',
  },
];

final result = await PhotoUploadService.uploadMultiplePhotos(
  photos: photos,
);

print('Uploaded ${result['total']} photos');
```

### **3. Delete Photo**

```dart
// Delete a photo
final result = await PhotoUploadService.deletePhoto('photo_id');
print('Photo deleted: ${result['message']}');
```

## 📋 **Error Handling**

### **Common Error Scenarios**

```dart
try {
  await PhotoUploadService.uploadPhoto(imageBytes: imageBytes);
} catch (e) {
  if (e.toString().contains('401')) {
    // Handle authentication error
    print('Please login again');
  } else if (e.toString().contains('413')) {
    // Handle file too large
    print('Image is too large. Please compress it.');
  } else if (e.toString().contains('400')) {
    // Handle validation error
    print('Invalid image format or data.');
  } else {
    // Handle other errors
    print('Upload failed: $e');
  }
}
```

## 🔧 **Configuration**

### **Environment Setup**

1. **Backend Configuration:**
   ```env
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

2. **Flutter Configuration:**
   - Add permissions to `android/app/src/main/AndroidManifest.xml`:
   ```xml
   <uses-permission android:name="android.permission.CAMERA" />
   <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
   <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
   ```

   - Add permissions to `ios/Runner/Info.plist`:
   ```xml
   <key>NSCameraUsageDescription</key>
   <string>This app needs camera access to take photos</string>
   <key>NSPhotoLibraryUsageDescription</key>
   <string>This app needs photo library access to select photos</string>
   ```

## 📊 **Performance Tips**

1. **Image Compression:** Always compress images before upload
2. **Caching:** Use `CachedNetworkImage` for better performance
3. **Batch Uploads:** Use multiple upload for better UX
4. **Error Handling:** Implement proper error handling and retry logic
5. **Loading States:** Show loading indicators during upload

This integration provides a complete solution for uploading photos from your Flutter app to the Locket backend with Cloudinary storage! 