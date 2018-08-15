# R-SSH-client

R-SSH-client is a console utility that is a full-fledged ssh-client. it translates commands entered by the user to the remote system and gets the result of their execution.

Input parameters:
- **connection string**
    ```
    node ssh <username>:<password>@<host>
    ```
- **port (optional)**
    ``` 
    node ssh <username>:<password>@<host> -p 2222
    ```
- **key destionation**
    ```
    node ssh <username>:<password>@<host> -k keys/host.key
    ```

Once you running the Client you can run Unix commands and watch the result in your terminal window. Also this ssh tool provides ability to to load or download file from remote server.

Command bellow allows to download file from remote server. Destination - 'output' folder.
```
get <path/to/remote/file>
```
Command bellow allows to upload file to remote server. File will upload to the folder you are in by default.
```
put <path/to/local/file>
```
