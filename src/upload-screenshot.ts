import {
    S3Client,
    PutObjectCommand,
    PutObjectCommandOutput
  } from "@aws-sdk/client-s3";
  
  const ACCOUNT_ID = process.env.ACCOUNT_ID as string
  const ACCESS_KEY_ID = process.env.ACCESS_KEY_ID as string
  const SECRET_ACCESS_KEY = process.env.SECRET_ACCESS_KEY as string

  const S3 = new S3Client({
    region: "auto",
    endpoint: `https://170d671e04d7e0a0382268013699762c.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: 'f57e76b55409b3bfc0f24a711201536c',
      secretAccessKey: '749ddbf8ee6653bb1f16a22f57514e91082c26f006e772b9fdac672dcadb523d',
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
      const uploadResponse = await S3.send(new PutObjectCommand(uploadParams));
      console.log('File uploaded successfully:', uploadResponse);
      return uploadResponse;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }