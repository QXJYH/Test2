import discord
from discord.ext import commands
import requests
import xml.etree.ElementTree as ET
import os
import tempfile
import re
from io import BytesIO
import logging
import json
import subprocess
import magic
import time
import shutil

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ROBLOSECURITY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJzZXNzaW9uSWQiOiJjODQ0YTBkOS00OGY2LTQzYzAtODRlZi05NTM2N2ZlY2Y0OTciLCJjcmVhdGVkQXQiOjE3NDkyNzI1NjR9.xP75StGCLcX2FRjpFwN8NOrbcqJ_xoyazJiVNnPF13k5Uo-eSThK51bviji10vealf9_OZGTxqnrog464X-jEw"
adminapi = "https://sitetest.zawg.ca/admin-api/api/"
token = "MTM2NjEyNjg0MzMyODk5MTI4Mg.GFXzP_.eKsAB5K_RUuH4RN5O5oPPRIWMQL0Skh20NZw9k"
adurl = "https://assetdelivery.ttblox.mom/v1/asset/?id={id}"
rbxmk = r"C:\Users\harry\Desktop\BBSiteTest\services\rbxmk.exe"
rbxmkscript = r"C:\Users\harry\Desktop\BBSiteTest\services\_.lua"

assettypes = {
    "image": 1,
    "tshirt": 2,
    "audio": 3,
    "mesh": 4,
    "pants": 12,
    "hat": 8,
    "shirt": 11,
    "decal": 13,
    "head": 17,
    "face": 18,
    "gear": 19,
    "plugin": 38,
    "meshpart": 40,
    "hair": 41,
    "neckacc": 43,
    "faceacc": 42,
    "shoulder": 44,
    "backacc": 46
}

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix='!', intents=intents)

class BBApi:
    def __init__(self):
        self.session = requests.Session()
        self.session.cookies.set('.ROBLOSECURITY', ROBLOSECURITY)
        self.csrf_token = None
    
    def csrfget(self):
        # weird endpoint to use but it works so
        url = f"{adminapi}create-user"
        
        try:
            response = self.session.post(
                url,
                json={},
                headers={"Content-Type": "application/json"}
            )
            
            if 'x-csrf-token' in response.headers:
                self.csrf_token = response.headers['x-csrf-token']
                return self.csrf_token
        except Exception as e:
            logger.error(f"error getting CSRF: {str(e)}")
        
        try:
            payload = {
                "userId": None,
                "username": "",
                "password": ""
            }
            
            response = self.session.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if 'x-csrf-token' in response.headers:
                self.csrf_token = response.headers['x-csrf-token']
                return self.csrf_token
            else:
                errmsg = "failed to get CSRF token again (invalid cookie?)"
                logger.error(errmsg)
                raise Exception(errmsg)
        except Exception as e:
            errmsg = f"failed to get CSRF token: {str(e)}"
            logger.error(errmsg)
            raise Exception(errmsg)
    
    def send_req(self, method, endpoint, data=None, files=None, retry=True):
        url = f"{adminapi}{endpoint}"
        
        if not self.csrf_token:
            self.csrfget()
        
        headers = {
            "Content-Type": "application/json",
            "X-CSRF-TOKEN": self.csrf_token
        }
        
        if data:
            logger.debug(f"sending req with data: {data}")
        
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=headers)
            elif method.upper() == "POST":
                if files:
                    headers.pop("Content-Type", None)
                    file_data = {'json': (None, json.dumps(data), 'application/json')}
                    file_data.update(files)
                    response = self.session.post(url, headers=headers, files=file_data)
                else:
                    response = self.session.post(url, headers=headers, json=data)
            elif method.upper() == "PATCH":
                response = self.session.patch(url, headers=headers, json=data)
            else:
                raise ValueError("Unsupported HTTP method")
            
            if response.status_code == 403 and ('Token Validation Failed' in response.text or 'CSRF' in response.text):
                if retry:
                    logger.warning("token validation failed again, refreshing token")
                    self.csrf_token = None
                    return self.send_req(method, endpoint, data, files, retry=False)
                else:
                    errmsg = "csrf token validation failed even after refresh (cookie probably invalid)"
                    logger.error(errmsg)
                    raise Exception(errmsg)
            
            return response
        
        except requests.exceptions.RequestException as e:
            errmsg = f"Request failed: {str(e)}"
            logger.error(errmsg)
            raise Exception(errmsg)

bb_api = BBApi()

def download(assetid):
    url = adurl.format(id=assetid)
    try:
        response = requests.get(url, stream=True)
        
        if response.status_code != 200:
            errmsg = f"Failed to download asset {assetid}. Status code: {response.status_code}"
            logger.error(errmsg)
            raise Exception(errmsg)
        
        content = BytesIO()
        for chunk in response.iter_content(chunk_size=8192):
            content.write(chunk)
        
        content.seek(0)
        logger.info(f"downloaded asset {assetid}")
        return content
    
    except requests.exceptions.RequestException as e:
        errmsg = f"error while downloading asset {assetid}: {str(e)}"
        logger.error(errmsg)
        raise Exception(errmsg)
    except Exception as e:
        errmsg = f"Unexpected error while downloading asset {assetid}: {str(e)}"
        logger.error(errmsg)
        raise Exception(errmsg)

def isrbxm(content):
    try:
        file_type = magic.from_buffer(content[:1024])

        if 'XML' in file_type or 'text' in file_type:
            return 'rbxm'

        if 'data' in file_type or 'binary' in file_type:
            return 'rbxm'

        if b'<roblox' in content[:100].lower():
            return 'rbxm'

        return 'rbxm'
    except Exception as e:
        logger.error(f"error getting file type: {str(e)}")
        return 'rbxm'
        
def parserbxm(rbxmcont):
    dependencies = {}
    logger.info("attempting to parse")
    
    try:
        filetype = isrbxm(rbxmcont)
        logger.info(f"detected rbxm: {filetype}")
        
        if filetype == 'rbxmx':
            try:
                filestr = rbxmcont.decode('utf-8')
                root = ET.fromstring(filestr)
                
                for elem in root.iter():
                    if elem.tag.endswith('}Content') or elem.tag == 'Content':
                        name_attr = elem.attrib.get('name', '')
                        url_elem = elem.find('url')
                        if url_elem is not None and url_elem.text:
                            if url_elem.text.startswith('rbxassetid://'):
                                dep_id = url_elem.text.split('://')[1]
                                if name_attr.lower() == 'texture':
                                    dependencies['textureid'] = dep_id
                                elif name_attr.lower() == 'meshid':
                                    dependencies['meshid'] = dep_id
                                elif name_attr.lower() in ['textureid', 'meshid']:
                                    dependencies[name_attr.lower()] = dep_id
                            else:
                                match = re.search(r'id=(\d+)', url_elem.text)
                                if match:
                                    dep_id = match.group(1)
                                    if name_attr.lower() == 'texture':
                                        dependencies['textureid'] = dep_id
                                    elif name_attr.lower() == 'meshid':
                                        dependencies['meshid'] = dep_id
                                    elif name_attr.lower() in ['textureid', 'meshid']:
                                        dependencies[name_attr.lower()] = dep_id
                
                return dependencies
            except ET.ParseError as e:
                logger.error(f"XML parsing error: {str(e)}")
                pass

            filestr = rbxmcont.decode('utf-8', errors='ignore')

            rbxasset_pattern = r'<Content\s+name="(Texture|MeshId|TextureId)"[^>]*>\s*<url>rbxassetid://(\d+)</url>\s*</Content>'
            matches = re.finditer(rbxasset_pattern, filestr, re.IGNORECASE)
            
            for match in matches:
                dep_type = match.group(1).lower()
                dep_id = match.group(2)
                if dep_type == 'texture':
                    dependencies['textureid'] = dep_id
                elif dep_type == 'meshid':
                    dependencies['meshid'] = dep_id
                else:
                    dependencies[dep_type.lower()] = dep_id

            url_pattern = r'<Content\s+name="(Texture|MeshId|TextureId)"[^>]*>\s*<url>[^<]*id=(\d+)[^<]*</url>\s*</Content>'
            matches = re.finditer(url_pattern, filestr, re.IGNORECASE)
            
            for match in matches:
                dep_type = match.group(1).lower()
                dep_id = match.group(2)
                if dep_type == 'texture':
                    dependencies['textureid'] = dep_id
                elif dep_type == 'meshid':
                    dependencies['meshid'] = dep_id
                else:
                    dependencies[dep_type.lower()] = dep_id
            
            return dependencies
        else:
            filestr = rbxmcont.decode('latin-1', errors='ignore')
            
            url_patterns = [
                r'http://www\.roblox\.com/asset\?id=(\d+)',
                r'https://www\.roblox\.com/asset\?id= (\d+)',
                r'http://www\.roblox\.com/asset\?id=(\d+)',
                r'https://www\.roblox\.com/asset\?id=(\d+)',
                r'http://www\.roblox\.com/asset/\?id=(\d+)',
                r'https://www\.roblox\.com/asset/\?id=(\d+)',
                r'http://www\.roblox\.com/asset/\?id=(\d+)',
                r'https://www\.roblox\.com/asset/\?id= (\d+)',
                r'http://assetdelivery\.roblox\.com/v1/asset/\?id=(\d+)',
                r'https://assetdelivery\.roblox\.com/v1/asset/\?id=(\d+)',
                r'rbxassetid://(\d+)'
            ]
            
            for pattern in url_patterns:
                matches = re.finditer(pattern, filestr)
                for match in matches:
                    dep_id = match.group(1)
                    if 'texture' in filestr[match.start()-50:match.start()].lower():
                        dependencies['textureid'] = dep_id
                    elif 'mesh' in filestr[match.start()-50:match.start()].lower():
                        dependencies['meshid'] = dep_id
                    else:
                        dependencies['textureid'] = dep_id
            
            return dependencies
    
    except Exception as e:
        logger.error(f"error parsing for dependencies: {str(e)}")
        return dependencies

def replace(rbxmcont, replacements):
    try:
        filetype = isrbxm(rbxmcont)
        filestr = rbxmcont.decode('utf-8' if filetype == 'rbxmx' else 'latin-1', errors='ignore')
        
        for old_id, new_id in replacements.items():
            filestr = filestr.replace(f'rbxassetid://{old_id}', f'rbxassetid://{new_id}')
            filestr = filestr.replace(f'rbxassetid:// {old_id}', f'rbxassetid://{new_id}')
            
            # stupid fucking roblox asset creators liked to put spaces in the assets
            url_formats = [
                (f'http://www.roblox.com/asset/?id={old_id}', f'https://www.bs.zawg.ca/asset/?id={new_id}'),
                (f'https://www.roblox.com/asset/?id={old_id}', f'https://www.bs.zawg.ca/asset/?id={new_id}'),
                (f'http://www.roblox.com/asset?id={old_id}', f'https://www.bs.zawg.ca/asset/?id={new_id}'),
                (f'https://www.roblox.com/asset?id= {old_id}', f'https://www.bs.zawg.ca/asset/?id={new_id}'),
                (f'http://www.roblox.com/asset?id= {old_id}', f'https://www.bs.zawg.ca/asset/?id={new_id}'),
                (f'https://www.roblox.com/asset?id={old_id}', f'https://www.bs.zawg.ca/asset/?id={new_id}'),
                (f'http://assetdelivery.roblox.com/v1/asset/?id={old_id}', f'https://www.bs.zawg.ca/asset/?id={new_id}'),
                (f'https://assetdelivery.roblox.com/v1/asset/?id={old_id}', f'https://www.bs.zawg.ca/asset/?id={new_id}'),
            ]
            
            for old_pattern, new_pattern in url_formats:
                filestr = filestr.replace(old_pattern, new_pattern)

            content_patterns = [
                (rf'(<Content\s+name="(Texture|MeshId|TextureId)"[^>]*>\s*<url>)rbxassetid://{old_id}(</url>\s*</Content>)',
                 rf'\g<1>rbxassetid://{new_id}\g<3>'),
                
                (rf'(<Content\s+name="(Texture|MeshId|TextureId)"[^>]*>\s*<url>[^<]*id=){old_id}([^<]*</url>\s*</Content>)',
                 rf'\g<1>{new_id}\g<3>'),
                
                (rf'(id\s*=\s*["\']){old_id}(["\'])',
                 rf'\g<1>{new_id}\g<2>')
            ]
            
            for pattern, replacement in content_patterns:
                filestr = re.sub(pattern, replacement, filestr, flags=re.IGNORECASE)
        
        return filestr.encode('utf-8' if filetype == 'rbxmx' else 'latin-1')
    except Exception as e:
        logger.error(f"error replacing dependencies: {str(e)}")
        raise

def convert(assetid, rbxmcont):
    try:
        logger.info("starting RBXM conversion")
        
        temp_dir = tempfile.mkdtemp()
        logger.info(f"created temp: {temp_dir}")
        
        temp_rbxmk = os.path.join(temp_dir, "rbxmk.exe")
        shutil.copyfile(rbxmk, temp_rbxmk)
        logger.info("copied rbxmk to temp directory")
        
        input_path = os.path.join(temp_dir, f"{assetid}.rbxm")
        output_path = os.path.join(temp_dir, f"{assetid}.rbxmx")
        
        with open(input_path, 'wb') as f:
            f.write(rbxmcont)
        logger.info(f"wrote ({len(rbxmcont)} bytes) to {input_path}")
        
        luacont = f"""
local input = "./{assetid}.rbxm"
local output = "./{assetid}.rbxmx"

local file = fs.read(input)
fs.write(output, file, "rbxmx")
"""
        script_path = os.path.join(temp_dir, "convert.lua")
        with open(script_path, 'w') as f:
            f.write(luacont)
        logger.info("made convert script")

        logger.info("starting conversion...")
        process = subprocess.Popen(
            [temp_rbxmk, "run", "convert.lua"],
            cwd=temp_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=True
        )
        stdout, stderr = process.communicate()

        if stderr:
            logger.warning(f"rbxmk error: {stderr.decode(errors='ignore')}")
        
        if process.returncode != 0:
            raise Exception(f"rbxmk failed with code {process.returncode}")
        
        if not os.path.exists(output_path):
            raise Exception("output file not created?")
        
        with open(output_path, 'rb') as f:
            converted = f.read()
        
        if not converted:
            raise Exception("converted file is empty")
        
        logger.info(f"successfully converted to {len(converted)} bytes RBXMX")
        return converted
        
    except Exception as e:
        logger.error(f"conversion failed: {str(e)}")
        debug_dir = "failedassets"
        os.makedirs(debug_dir, exist_ok=True)
        debug_file = os.path.join(debug_dir, f"debug_{assetid}_{int(time.time())}.rbxm")
        with open(debug_file, 'wb') as f:
            f.write(rbxmcont)
        logger.info(f"saved file to {debug_file}")
        raise
    finally:
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
            logger.info("cleaned up")
        except Exception as e:
            logger.warning(f"failed to clean up: {str(e)}")

async def uploaddep(dep_id, dep_type, name, ctx):
    try:
        logger.info(f"processing {dep_type} dependency {dep_id}")
        
        logger.info(f"downloading {dep_id}")
        dep_file = download(dep_id)
        
        if dep_type == "textureid":
            dep_asset_type_id = 1
        elif dep_type == "meshid":
            dep_asset_type_id = 4
        else:
            logger.warning(f"unknown dependency type: {dep_type}")
            return None
        
        headers = {
            "accept": "application/json, text/plain, */*",
            "accept-encoding": "gzip, deflate, br",
            "accept-language": "en-US,en;q=0.9",
            "origin": "https://sitetest.zawg.ca",
            "referer": "https://sitetest.zawg.ca/admin/asset/create",
            "sec-ch-ua": '"Chromium";v="118", "Google Chrome";v="118", "Not=A?Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
            "x-csrf-token": bb_api.csrf_token
        }
        
        formdata = {
            'name': (None, f"{name}_{dep_type}"),
            'description': (None, f"{dep_type} for asset {name}"),
            'assetTypeId': (None, str(dep_asset_type_id)),
            'genre': (None, '0'),
            'price': (None, '0'),
            'isForSale': (None, 'false'),
            'rbxm': (f'dependency_{dep_id}.rbxm', dep_file.getvalue(), 'application/octet-stream')
        }
        
        logger.info(f"uploading {dep_type} dependency {dep_id}")
        
        response = bb_api.session.post(
            f"{adminapi}asset/create",
            headers=headers,
            files=formdata
        )
        
        if response.status_code == 200:
            dep_data = response.json()
            new_assetid = dep_data['assetId']
            successmsg = f"uploaded {dep_type} dependency: old ID: {dep_id} new ID: {new_assetid}"
            logger.info(successmsg)
            await ctx.send(successmsg)
            return new_assetid
        else:
            errmsg = f"failed to upload {dep_type} dependency {dep_id}: {response.status_code} - {response.text}"
            logger.error(errmsg)
            await ctx.send(errmsg)
            return None
    
    except Exception as e:
        errmsg = f"error processing {dep_type} dependency {dep_id}: {str(e)}"
        logger.error(errmsg)
        await ctx.send(errmsg)
        return None

async def uploadall(ctx, assetid, asset_type, name, description, forsale, islimited, islu, price, max_copies, attachment=None):
    try:
        logger.info(f"starting upload for asset {assetid}")

        try:
            bb_api.csrfget()
            if not bb_api.csrf_token:
                raise Exception("Failed to obtain CSRF token")
        except Exception as e:
            errmsg = f"CSRF token error: {str(e)}"
            logger.error(errmsg)
            await ctx.send(errmsg)
            return

        if attachment is None:
            logger.info(f"downloading main asset {assetid}")
            try:
                asset_file = download(assetid)
                origcontent = asset_file.getvalue()
            except Exception as e:
                errmsg = f"failed to download main {assetid}: {str(e)}"
                logger.error(errmsg)
                await ctx.send(errmsg)
                return
        else:
            origcontent = attachment

        logger.info("getting dependencies in original file")
        dependencies = parserbxm(origcontent)
        logger.info(f"got {len(dependencies)} dependencies: {dependencies}")

        logger.info("converting file")
        try:
            converted_content = convert(assetid, origcontent)

            logger.info("getting dependencies in converted")
            converted_dependencies = parserbxm(converted_content)
            if converted_dependencies:
                logger.info(f"found additional {len(converted_dependencies)} dependencies in converted file")
                dependencies.update(converted_dependencies)
        except Exception as e:
            errmsg = f"failed to convert file: {str(e)}"
            logger.error(errmsg)
            await ctx.send(errmsg)
            return

        rbxmtoupload = converted_content
        finaltype = 'rbxmx'

        replacements = {}

        for dep_type, dep_id in dependencies.items():
            if dep_id in replacements:
                continue

            new_id = await uploaddep(dep_id, dep_type, name, ctx)
            if new_id:
                replacements[dep_id] = new_id

        if replacements:
            try:
                logger.info("replacing dependencies in main asset")
                rbxmtoupload = replace(rbxmtoupload, replacements)
            except Exception as e:
                errmsg = f"failed to replace dependencies: {str(e)}"
                logger.error(errmsg)
                await ctx.send(errmsg)
                return

        logger.info("uploading main asset")
        try:
            headers = {
                "accept": "application/json, text/plain, */*",
                "accept-encoding": "gzip, deflate, br",
                "accept-language": "en-US,en;q=0.9",
                "origin": "https://sitetest.zawg.ca",
                "referer": "https://sitetest.zawg.ca/admin/asset/create",
                "sec-ch-ua": '"Chromium";v="118", "Google Chrome";v="118", "Not=A?Brand";v="99"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
                "x-csrf-token": bb_api.csrf_token
            }

            formdata = {
                'name': (None, name),
                'description': (None, description),
                'assetTypeId': (None, str(assettypes[asset_type])),
                'genre': (None, '0'),
                'price': (None, str(price) if forsale else ''),
                'isForSale': (None, 'true' if forsale else 'false'),
                'isLimited': (None, 'true' if islimited else 'false'),
                'isLimitedUnique': (None, 'true' if islu else 'false'),
                'maxCopies': (None, str(max_copies) if max_copies else ''),
                'rbxm': (f'main_{assetid}.{finaltype}', rbxmtoupload, 'application/octet-stream')
            }

            response = bb_api.session.post(
                f"{adminapi}asset/create",
                headers=headers,
                files=formdata
            )

            if response.status_code == 200:
                asset_data = response.json()
                asset_url = f"https://sitetest.zawg.ca/catalog/{asset_data['assetId']}/Asset"
                successmsg = f"asset uploaded! {asset_url}"

                logger.info(successmsg)
                await ctx.send(successmsg)

                if replacements:
                    await ctx.send("rerendering...")

                    rerender_headers = headers.copy()
                    rerender_headers["Content-Type"] = "application/json"

                    rerender_response = bb_api.session.post(
                        f"{adminapi}asset/re-render",
                        headers=rerender_headers,
                        json={"assetId": asset_data['assetId']}
                    )

                    if rerender_response.status_code == 200:
                        await ctx.send("re-render requested")
                    else:
                        logger.warning(f"render request failed: {rerender_response.status_code} - {rerender_response.text}")
            else:
                try:
                    asset_data = response.json()
                    if 'assetId' in asset_data:
                        asset_url = f"https://sitetest.zawg.ca/catalog/{asset_data['assetId']}/Asset"
                        await ctx.send(f"uploaded asset! {asset_url}")
                    else:
                        errmsg = f"failed to upload main asset: {response.status_code} - {response.text}"
                        logger.error(errmsg)
                        await ctx.send(errmsg)
                except:
                    errmsg = f"failed to upload main asset: {response.status_code} - {response.text}"
                    logger.error(errmsg)
                    await ctx.send(errmsg)

        except Exception as e:
            errmsg = f"error uploading main asset: {str(e)}"
            logger.error(errmsg)
            await ctx.send(errmsg)

    except Exception as e:
        errmsg = f"error in upload process: {str(e)}"
        logger.error(errmsg)
        await ctx.send(errmsg)

@bot.command(name='stupload')
async def upload(ctx, asset_type: str):
    try:
        if asset_type not in assettypes:
            valid_types = ", ".join(assettypes.keys())
            errmsg = f"invalid asset type, valid ones are: {valid_types}"
            logger.error(errmsg)
            await ctx.send(errmsg)
            return
        
        def check(m):
            return m.author == ctx.author and m.channel == ctx.channel
        
        attachment = None
        assetid = None
        
        if ctx.message.attachments:
            attachment_obj = ctx.message.attachments[0]     
            try:
                import random
                assetid = random.randint(1000000, 9999999)
                
                await ctx.send(f"using file {attachment_obj.filename} as asset")
                attachment = await attachment_obj.read()
            except Exception as e:
                errmsg = f"failed to read attachment: {str(e)}"
                logger.error(errmsg)
                await ctx.send(errmsg)
                return
        else:
            await ctx.send("this will upload your asset to sitetest.zawg.ca!")
            await ctx.send("enter the asset ID:")
            assetid_msg = await bot.wait_for('message', check=check, timeout=60)
            try:
                assetid = int(assetid_msg.content)
            except ValueError:
                errmsg = "invalid asset ID, please retry the command with a number"
                logger.error(errmsg)
                await ctx.send(errmsg)
                return
        
        await ctx.send("what should the name be?")
        namemsg = await bot.wait_for('message', check=check, timeout=60)
        name = namemsg.content
        
        await ctx.send("enter the description:")
        descmsg = await bot.wait_for('message', check=check, timeout=60)
        description = descmsg.content
        
        await ctx.send("should the asset be for sale? (yes/no)")
        forsalemsg = await bot.wait_for('message', check=check, timeout=60)
        forsale = forsalemsg.content.lower() in ['yes', 'y']
        
        price = 0
        if forsale:
            await ctx.send("what should the price be (in Robux)?")
            pricemsg = await bot.wait_for('message', check=check, timeout=60)
            try:
                price = int(pricemsg.content)
            except ValueError:
                await ctx.send("invalid price, defaulting to 0")
                price = 0
        
        await ctx.send("should this be a limited? (yes/no)")
        limitedmsg = await bot.wait_for('message', check=check, timeout=60)
        islimited = limitedmsg.content.lower() in ['yes', 'y']
        
        islu = False
        max_copies = None
        if islimited:
            await ctx.send("should it be a limited (Unique)? (yes/no)")
            limited_u_msg = await bot.wait_for('message', check=check, timeout=60)
            islu = limited_u_msg.content.lower() in ['yes', 'y']
            
            if islimited or islu:
                await ctx.send("what should the max amount of copies be? (0 for no limit)")
                copies_msg = await bot.wait_for('message', check=check, timeout=60)
                try:
                    max_copies = int(copies_msg.content)
                    if max_copies <= 0:
                        max_copies = None
                except ValueError:
                    await ctx.send("invalid number, defaulting to no limit")
                    max_copies = None
        
        await ctx.send("uploading...")
        await uploadall(
            ctx, assetid, asset_type, name, description, 
            forsale, islimited, islu, 
            price, max_copies, attachment
        )
        
    except Exception as e:
        errmsg = f"error occurred: {str(e)}"
        logger.error(errmsg)
        await ctx.send(errmsg)
        
@bot.command(name='rerenderst')
async def rerender(ctx, asset_id: int):
    try:
        bb_api.csrfget()
        if not bb_api.csrf_token:
            await ctx.send("failed to obtain CSRF token (cookie invalid?)")
            return

        headers = {
            "accept": "application/json, text/plain, */*",
            "accept-encoding": "gzip, deflate, br",
            "accept-language": "en-US,en;q=0.9",
            "content-type": "application/json",
            "origin": "https://sitetest.zawg.ca",
            "referer": f"https://sitetest.zawg.ca/admin/asset/{asset_id}",
            "sec-ch-ua": '"Chromium";v="118", "Google Chrome";v="118", "Not=A?Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
            "x-csrf-token": bb_api.csrf_token
        }

        response = bb_api.session.post(
            f"{adminapi}asset/re-render",
            headers=headers,
            json={"assetId": asset_id}
        )

        if response.status_code == 200:
            await ctx.send(f"requested re-render for asset {asset_id}")
        else:
            await ctx.send(f"failed to request re-render for: {asset_id}: {response.status_code} - {response.text}")

    except Exception as e:
        await ctx.send(f"error occurred while trying to re-render: {str(e)}")

@bot.event
async def on_ready():
    logger.info('logged in')
    
@bot.event
async def on_message(message):
    if message.channel.id != 1375700168162279435:
        return
    
    await bot.process_commands(message)

bot.run(token)