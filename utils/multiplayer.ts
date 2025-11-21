
import { Peer } from 'peerjs';
import { NetworkMessage } from '../types';

type DataCallback = (data: NetworkMessage) => void;

// Generate a short 6-character ID (excluding ambiguous chars like I, 1, O, 0)
const generateShortId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Configuration for STUN servers to navigate firewalls/NATs (NAT Traversal)
const PEER_CONFIG: any = {
  debug: 2, // 1: Errors, 2: Warnings, 3: All
  config: {
    iceServers: [
      // Google's public STUN servers are highly reliable for free NAT traversal
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ],
  },
};

class MultiplayerManager {
  private peer: Peer | null = null;
  private connections: any[] = [];
  private onDataReceived: DataCallback | null = null;
  private myId: string = '';
  private roomName: string = 'UNO Room';

  initialize(onData: DataCallback) {
    this.onDataReceived = onData;
  }

  setRoomName(name: string) {
    this.roomName = name;
  }

  async hostGame(): Promise<string> {
    // Ensure clean state
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    return new Promise((resolve, reject) => {
      const attemptHost = (retriesLeft: number) => {
        if (retriesLeft === 0) {
          reject(new Error("Unable to generate a unique Room ID. Please try again."));
          return;
        }

        const id = generateShortId();
        // Create peer with specific short ID AND config
        const tempPeer = new Peer(id, PEER_CONFIG);

        const onError = (err: any) => {
          if (err.type === 'unavailable-id') {
            tempPeer.destroy();
            attemptHost(retriesLeft - 1);
          } else {
            reject(err);
          }
        };

        // Temporary error listener for creation phase
        tempPeer.on('error', onError);

        tempPeer.on('open', (id) => {
          tempPeer.off('error', onError); // Remove creation error handler
          
          this.peer = tempPeer;
          this.myId = id;
          console.log('Hosting game with ID:', id);
          
          // Runtime error handler
          this.peer.on('error', (err) => console.error('Peer error:', err));

          this.peer.on('connection', (conn) => {
            console.log('New client connected:', conn.peer);
            
            conn.on('open', () => {
                 this.connections.push(conn);
                 // Send Room Info immediately
                 conn.send({ type: 'ROOM_INFO', payload: { name: this.roomName } });
                 
                 // Inform app that someone joined (Update List)
                 if (this.onDataReceived) {
                     this.onDataReceived({ type: 'PLAYER_JOINED', payload: { count: this.connections.length } }); 
                 }
            });

            conn.on('data', (data: any) => {
                if (this.onDataReceived) this.onDataReceived(data);
            });
            
            conn.on('close', () => {
                // Remove closed connection
                this.connections = this.connections.filter(c => c.peer !== conn.peer);
                if (this.onDataReceived) {
                     this.onDataReceived({ type: 'PLAYER_LEFT', payload: { count: this.connections.length } });
                }
            });
          });

          resolve(id);
        });
      };

      attemptHost(5); // Try up to 5 times to get a unique ID
    });
  }

  async joinGame(hostId: string): Promise<void> {
    // Ensure clean state before joining
    if (this.peer) {
        this.peer.destroy();
        this.peer = null;
    }

    return new Promise((resolve, reject) => {
      let isConnected = false;
      
      // 1. Create Client Peer with Config
      this.peer = new Peer(PEER_CONFIG);

      // 2. Set safety timeout (10 seconds)
      const timeoutId = setTimeout(() => {
          if (!isConnected) {
              if (this.peer) {
                  this.peer.destroy();
                  this.peer = null;
              }
              reject(new Error("Connection timed out. The room code might be wrong, or the host is behind a firewall/different network."));
          }
      }, 10000);

      // 3. Listen for ID generation (Peer Open)
      this.peer.on('open', (myId) => {
        this.myId = myId;
        
        // 4. Connect to Host
        const conn = this.peer!.connect(hostId, { reliable: true });
        
        if (!conn) {
            clearTimeout(timeoutId);
            reject(new Error("Could not initiate connection to host."));
            return;
        }

        conn.on('open', () => {
          clearTimeout(timeoutId);
          isConnected = true;
          console.log('Connected to host:', hostId);
          this.connections.push(conn);
          resolve();
        });

        conn.on('data', (data: any) => {
            if (this.onDataReceived) this.onDataReceived(data);
            
            // Handle being kicked at the protocol level
            if (data.type === 'KICKED') {
                this.disconnect();
            }
        });
        
        conn.on('close', () => {
             if (this.onDataReceived) this.onDataReceived({ type: 'KICKED' }); // Generic disconnect signal
        });

        conn.on('error', (err) => {
             if (!isConnected) {
                 clearTimeout(timeoutId);
                 reject(err);
             } else {
                 console.error("Connection error:", err);
             }
        });
      });

      // 5. Global Peer Errors (e.g. peer-unavailable)
      this.peer.on('error', (err: any) => {
         if (!isConnected) {
             clearTimeout(timeoutId);
             // Enhance error message for common PeerJS errors
             if (err.type === 'peer-unavailable') {
                 reject(new Error(`Room "${hostId}" not found. Please check the code.`));
             } else {
                 reject(err);
             }
         } else {
             console.error("Peer error:", err);
         }
      });
    });
  }

  kickClient(index: number) {
      const conn = this.connections[index];
      if (conn) {
          // Send polite notice
          conn.send({ type: 'KICKED' });
          
          // Close after short delay to ensure message sends
          setTimeout(() => {
              conn.close();
          }, 100);
          
          // Update local list immediately
          this.connections.splice(index, 1);
          if (this.onDataReceived) {
              this.onDataReceived({ type: 'PLAYER_LEFT', payload: { count: this.connections.length } });
          }
      }
  }

  broadcast(msg: NetworkMessage) {
    this.connections.forEach(conn => {
        if (conn.open) conn.send(msg);
    });
  }

  sendToHost(msg: NetworkMessage) {
      // Client only has one connection (the host)
      if (this.connections.length > 0 && this.connections[0].open) {
          this.connections[0].send(msg);
      }
  }

  disconnect() {
      this.connections.forEach(c => c.close());
      this.connections = [];
      if (this.peer) this.peer.destroy();
      this.peer = null;
  }

  getId() {
      return this.myId;
  }
}

export const mpManager = new MultiplayerManager();
