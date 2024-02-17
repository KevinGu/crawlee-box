import {
    S3Client,
    PutObjectCommand,
    PutObjectCommandOutput
  } from "@aws-sdk/client-s3";

  const S3 = new S3Client({
    region: "auto",
    endpoint: process.env.ENDPOINT as string,
    credentials: {
      accessKeyId: process.env.ACCESS_KEY_ID as string,
      secretAccessKey: process.env.SECRET_ACCESS_KEY as string,
    },
  })

  export async function uploadScreenshot(
    bucketName: string, 
    fileName: string, 
    fileContent: Buffer  
  ): Promise<PutObjectCommandOutput> {
    const uploadParams = {
      Bucket: bucketName,
      Key: fileName,
      Body: fileContent,
      ContentType: 'image/webp'
    };
  
    try {
      console.log('Uploading file to S3:', process.env.ENDPOINT as string);
      const uploadResponse = await S3.send(new PutObjectCommand(uploadParams));
      console.log('File uploaded successfully:', uploadResponse);
      return uploadResponse;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }